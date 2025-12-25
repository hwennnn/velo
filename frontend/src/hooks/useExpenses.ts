/**
 * React Query hooks for Expense operations
 */
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { CreateExpenseInput, Expense } from '../types';
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
  member_id?: number;
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

// Create expense mutation
export function useCreateExpense(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateExpenseInput) => {
      const response = await api.expenses.create(tripId, data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all expense queries for this trip (including infinite queries with different filters)
      queryClient.invalidateQueries({ 
        queryKey: expenseKeys.lists(),
        predicate: (query) => {
          // Match any expense query that includes this tripId
          return query.queryKey.includes(tripId);
        }
      });
      // Invalidate trip data (for totals and metadata)
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
    },
  });
}

// Delete expense mutation
export function useDeleteExpense(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expenseId: number) => {
      await api.expenses.delete(tripId, expenseId);
    },
    onSuccess: () => {
      // Invalidate all expense queries for this trip (including infinite queries with different filters)
      queryClient.invalidateQueries({ 
        queryKey: expenseKeys.lists(),
        predicate: (query) => {
          // Match any expense query that includes this tripId
          return query.queryKey.includes(tripId);
        }
      });
      // Invalidate trip data (for totals and metadata)
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
    },
  });
}

