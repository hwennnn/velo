/**
 * React Query hooks for Expense operations
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { api } from '../services/api';
import type { CreateExpenseInput, Expense, TripMember, UpdateExpenseInput } from '../types';
import { balanceKeys } from './useBalances';
import { tripKeys } from './useTrips';

// Query Keys
export const expenseKeys = {
  all: ['expenses'] as const,
  lists: () => [...expenseKeys.all, 'list'] as const,
  list: (tripId: string, filters?: ExpenseFilters) => [...expenseKeys.lists(), tripId, filters] as const,
  infinite: (tripId: string, filters?: ExpenseFilters) => [...expenseKeys.lists(), tripId, 'infinite', filters] as const,
  details: () => [...expenseKeys.all, 'detail'] as const,
  detail: (tripId: string, id: number) => [...expenseKeys.details(), tripId, id] as const,
};

// Types for pagination
export interface ExpenseFilters {
  category?: string;
  paid_by_member_id?: number;
  expense_type?: string;
}

export interface ExpensePage {
  expenses: Expense[];
  total: number;
  page: number;
  page_size: number;
}

// Fetch expenses for a trip with infinite scrolling
export function useExpenses(tripId: string | undefined, filters?: ExpenseFilters) {
  return useInfiniteQuery({
    queryKey: expenseKeys.infinite(tripId!, filters),
    queryFn: async ({ pageParam = 1 }) => {
      const params = {
        page: pageParam,
        page_size: 20,
        ...filters,
      };
      const response = await api.expenses.getAll(tripId!, params);
      return response.data as ExpensePage;
    },
    enabled: !!tripId,
    getNextPageParam: (lastPage) => {
      const hasMore = lastPage.expenses.length === lastPage.page_size && 
                     (lastPage.page * lastPage.page_size) < lastPage.total;
      return hasMore ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 1,
  });
}

// Fetch single expense by ID (with initial data from list cache for faster FMP)
export function useExpense(tripId: string | undefined, expenseId: number | undefined, initialExpense?: Expense) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: expenseKeys.detail(tripId ?? '', expenseId ?? 0),
    queryFn: async () => {
      const response = await api.expenses.getById(tripId!, expenseId!);
      return response.data as Expense;
    },
    enabled: !!tripId && !!expenseId && expenseId > 0, // Don't fetch for optimistic (negative) IDs
    // Use provided initial expense or search in infinite query cache
    initialData: () => {
      if (initialExpense) return initialExpense;
      if (!tripId || !expenseId) return undefined;
      
      // Try to find in infinite query cache
      const infiniteQueries = queryClient.getQueriesData<InfiniteData<ExpensePage>>({
        queryKey: expenseKeys.lists(),
        predicate: (q) => q.queryKey.includes(tripId)
      });
      
      for (const [, data] of infiniteQueries) {
        if (data?.pages) {
          for (const page of data.pages) {
            const found = page.expenses.find(e => e.id === expenseId);
            if (found) return found;
          }
        }
      }
      return undefined;
    },
    initialDataUpdatedAt: () => {
      if (!tripId) return undefined;
      
      // Get most recent update time from any expense list query
      const states = queryClient.getQueriesData<InfiniteData<ExpensePage>>({
        queryKey: expenseKeys.lists(),
        predicate: (q) => q.queryKey.includes(tripId)
      });
      
      let latestUpdate = 0;
      for (const [key] of states) {
        const state = queryClient.getQueryState(key);
        if (state?.dataUpdatedAt && state.dataUpdatedAt > latestUpdate) {
          latestUpdate = state.dataUpdatedAt;
        }
      }
      return latestUpdate || undefined;
    },
  });
}

// Create expense mutation with optimistic update
export function useCreateExpense(tripId: string, members?: TripMember[], currentUserId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateExpenseInput) => {
      const response = await api.expenses.create(tripId, data);
      return response.data as Expense;
    },
    onMutate: async (newExpenseData) => {
      // Cancel any outgoing refetches for expense queries
      await queryClient.cancelQueries({ 
        queryKey: expenseKeys.lists(),
        predicate: (q) => q.queryKey.includes(tripId) 
      });
      
      // Snapshot current data for rollback
      const previousData = queryClient.getQueriesData<InfiniteData<ExpensePage>>({ 
        queryKey: expenseKeys.lists(),
        predicate: (q) => q.queryKey.includes(tripId)
      });
      
      // Build optimistic expense
      const optimisticId = `optimistic-${Date.now()}`;
      const payer = members?.find(m => m.id === newExpenseData.paid_by_member_id);
      const optimisticExpense: Expense = {
        id: -Date.now(), // Temporary negative ID
        trip_id: Number(tripId),
        description: newExpenseData.description,
        amount: newExpenseData.amount,
        currency: newExpenseData.currency,
        exchange_rate_to_base: 1, // Placeholder
        amount_in_base_currency: newExpenseData.amount, // Placeholder
        paid_by_member_id: newExpenseData.paid_by_member_id,
        paid_by_nickname: payer?.nickname || 'Unknown',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        category: newExpenseData.category,
        notes: newExpenseData.notes,
        receipt_url: newExpenseData.receipt_url,
        expense_type: newExpenseData.expense_type || 'expense',
        created_by: currentUserId || '',
        splits: [], // Will be calculated server-side
        _isOptimistic: true,
        _optimisticId: optimisticId,
      };
      
      // Optimistically add to all expense queries for this trip
      queryClient.setQueriesData<InfiniteData<ExpensePage>>(
        { queryKey: expenseKeys.lists(), predicate: (q) => q.queryKey.includes(tripId) },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page, index) => 
              index === 0 
                ? { ...page, expenses: [optimisticExpense, ...page.expenses], total: page.total + 1 }
                : page
            ),
          };
        }
      );
      
      return { previousData, optimisticId };
    },
    onSuccess: (data, _variables, context) => {
      // Replace optimistic expense with real data
      queryClient.setQueriesData<InfiniteData<ExpensePage>>(
        { queryKey: expenseKeys.lists(), predicate: (q) => q.queryKey.includes(tripId) },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              expenses: page.expenses.map((exp) =>
                exp._optimisticId === context?.optimisticId ? { ...data, _isOptimistic: false } : exp
              ),
            })),
          };
        }
      );
      
      // Invalidate to ensure sync with server
      queryClient.invalidateQueries({ 
        queryKey: expenseKeys.lists(),
        predicate: (q) => q.queryKey.includes(tripId)
      });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: balanceKeys.trip(tripId) });
    },
    onError: (_error, _variables, context) => {
      // Rollback to previous data on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          if (data) queryClient.setQueryData(queryKey, data);
        });
      }
    },
  });
}

// Delete expense mutation with optimistic removal
export function useDeleteExpense(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expenseId: number) => {
      await api.expenses.delete(tripId, expenseId);
      return expenseId;
    },
    onMutate: async (expenseId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: expenseKeys.lists(),
        predicate: (q) => q.queryKey.includes(tripId) 
      });
      
      // Snapshot for rollback
      const previousData = queryClient.getQueriesData<InfiniteData<ExpensePage>>({ 
        queryKey: expenseKeys.lists(),
        predicate: (q) => q.queryKey.includes(tripId)
      });
      
      // Optimistically remove expense from all queries
      queryClient.setQueriesData<InfiniteData<ExpensePage>>(
        { queryKey: expenseKeys.lists(), predicate: (q) => q.queryKey.includes(tripId) },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              expenses: page.expenses.filter((exp) => exp.id !== expenseId),
              total: Math.max(0, page.total - 1),
            })),
          };
        }
      );
      
      return { previousData };
    },
    onError: (_error, _expenseId, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          if (data) queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Always refetch to ensure sync
      queryClient.invalidateQueries({ 
        queryKey: expenseKeys.lists(),
        predicate: (q) => q.queryKey.includes(tripId)
      });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: balanceKeys.trip(tripId) });
    },
  });
}

// Update expense mutation with optimistic update
export function useUpdateExpense(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { expenseId: number; data: UpdateExpenseInput }) => {
      const response = await api.expenses.update(tripId, params.expenseId, params.data);
      return response.data as Expense;
    },
    onMutate: async ({ expenseId, data }) => {
      // Cancel outgoing refetches for both list and detail queries
      await queryClient.cancelQueries({ 
        queryKey: expenseKeys.lists(),
        predicate: (q) => q.queryKey.includes(tripId) 
      });
      await queryClient.cancelQueries({ 
        queryKey: expenseKeys.detail(tripId, expenseId) 
      });
      
      // Snapshot for rollback
      const previousListData = queryClient.getQueriesData<InfiniteData<ExpensePage>>({ 
        queryKey: expenseKeys.lists(),
        predicate: (q) => q.queryKey.includes(tripId)
      });
      const previousDetailData = queryClient.getQueryData<Expense>(
        expenseKeys.detail(tripId, expenseId)
      );
      
      // Optimistically update expense (only update display fields, not splits)
      const { splits: _splits, split_type: _splitType, ...displayFields } = data;
      
      // Update in list queries
      queryClient.setQueriesData<InfiniteData<ExpensePage>>(
        { queryKey: expenseKeys.lists(), predicate: (q) => q.queryKey.includes(tripId) },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              expenses: page.expenses.map((exp) =>
                exp.id === expenseId 
                  ? { ...exp, ...displayFields, _isOptimistic: true, updated_at: new Date().toISOString() }
                  : exp
              ),
            })),
          };
        }
      );
      
      // Update in detail query (useExpense)
      queryClient.setQueryData<Expense>(
        expenseKeys.detail(tripId, expenseId),
        (old) => old ? { ...old, ...displayFields, _isOptimistic: true, updated_at: new Date().toISOString() } : old
      );
      
      return { previousListData, previousDetailData, expenseId };
    },
    onSuccess: (data, { expenseId }) => {
      // Replace with real data from server in list queries
      queryClient.setQueriesData<InfiniteData<ExpensePage>>(
        { queryKey: expenseKeys.lists(), predicate: (q) => q.queryKey.includes(tripId) },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              expenses: page.expenses.map((exp) =>
                exp.id === expenseId ? { ...data, _isOptimistic: false } : exp
              ),
            })),
          };
        }
      );
      
      // Update detail query with real data
      queryClient.setQueryData<Expense>(
        expenseKeys.detail(tripId, expenseId),
        { ...data, _isOptimistic: false }
      );
      
      // Invalidate to ensure sync
      queryClient.invalidateQueries({ 
        queryKey: expenseKeys.lists(),
        predicate: (q) => q.queryKey.includes(tripId)
      });
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(tripId, expenseId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: balanceKeys.trip(tripId) });
    },
    onError: (_error, { expenseId }, context) => {
      // Rollback list data on error
      if (context?.previousListData) {
        context.previousListData.forEach(([queryKey, data]) => {
          if (data) queryClient.setQueryData(queryKey, data);
        });
      }
      // Rollback detail data on error
      if (context?.previousDetailData) {
        queryClient.setQueryData(
          expenseKeys.detail(tripId, expenseId),
          context.previousDetailData
        );
      }
    },
  });
}


