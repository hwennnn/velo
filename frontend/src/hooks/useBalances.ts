/**
 * React Query hooks for Balance operations
 */
import { useMutation, useQuery, useQueryClient, type InfiniteData, type UseQueryResult } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { api } from '../services/api';
import type { BalancesResponse, BulkConversionRequest, Expense, TripMember } from '../types';
import { expenseKeys, type ExpensePage } from './useExpenses';
import { totalsKeys } from './useTotals';
import { tripKeys } from './useTrips';

// Query Keys
export const balanceKeys = {
  all: ['balances'] as const,
  trip: (tripId: string) => [...balanceKeys.all, tripId] as const,
};

// Fetch balances for a trip
// - simplify: net out reverse debts per pair/currency (default from trip setting)
// - minimize: convert to base currency and minimize transactions (default false)
export function useBalances(
  tripId: string | undefined,
  options?: { minimize?: boolean }
): UseQueryResult<BalancesResponse> {
  const { minimize } = options || {};
  
  // Build query key based on options
  const queryKey = minimize !== undefined
    ? [...balanceKeys.trip(tripId!), { minimize }]
    : balanceKeys.trip(tripId!);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await api.balances.get(tripId!, minimize);
      return response.data;
    },
    enabled: !!tripId,
  });
}

// Create a settlement (creates a settlement expense) with optimistic update
export function useCreateSettlement(tripId: string, members?: TripMember[], currentUserId?: string) {
  const qClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settlementData: {
      from_member_id: number;
      to_member_id: number;
      amount: number;
      currency: string;
      notes?: string;
    }) => {
      const response = await api.balances.createSettlement(tripId, settlementData);
      return response.data as Expense;
    },
    onMutate: async (settlementData) => {
      // Cancel outgoing refetches
      await qClient.cancelQueries({ 
        queryKey: expenseKeys.lists(),
        predicate: (q) => q.queryKey.includes(tripId) 
      });
      
      // Snapshot for rollback
      const previousExpenses = qClient.getQueriesData<InfiniteData<ExpensePage>>({ 
        queryKey: expenseKeys.lists(),
        predicate: (q) => q.queryKey.includes(tripId)
      });
      
      // Build optimistic settlement expense
      const optimisticId = `optimistic-settlement-${Date.now()}`;
      const fromMember = members?.find(m => m.id === settlementData.from_member_id);
      const toMember = members?.find(m => m.id === settlementData.to_member_id);
      const optimisticExpense: Expense = {
        id: -Date.now(),
        trip_id: Number(tripId),
        description: settlementData.notes || `${fromMember?.nickname || 'Unknown'} → ${toMember?.nickname || 'Unknown'}`,
        amount: settlementData.amount,
        currency: settlementData.currency,
        exchange_rate_to_base: 1,
        amount_in_base_currency: settlementData.amount,
        paid_by_member_id: settlementData.from_member_id,
        paid_by_nickname: fromMember?.nickname || 'Unknown',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expense_type: 'settlement',
        created_by: currentUserId || '',
        splits: [],
        _isOptimistic: true,
        _optimisticId: optimisticId,
      };
      
      // Optimistically add to expense list
      qClient.setQueriesData<InfiniteData<ExpensePage>>(
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
      
      return { previousExpenses, optimisticId };
    },
    onSuccess: (data, _variables, context) => {
      // Replace optimistic expense with real data
      qClient.setQueriesData<InfiniteData<ExpensePage>>(
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
      
      // Invalidate balances and expenses
      queryClient.invalidateQueries({ queryKey: balanceKeys.trip(tripId) });
      queryClient.invalidateQueries({ 
        queryKey: expenseKeys.lists(),
        predicate: (q) => q.queryKey.includes(tripId)
      });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: totalsKeys.trip(tripId) });
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousExpenses) {
        context.previousExpenses.forEach(([queryKey, data]) => {
          if (data) qClient.setQueryData(queryKey, data);
        });
      }
    },
  });
}

// Convert all debts to a single currency
export function useConvertAllDebts(tripId: string) {
  return useMutation({
    mutationFn: async (conversionData: BulkConversionRequest) => {
      const response = await api.balances.convertAllDebts(tripId, conversionData);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate balances
      queryClient.invalidateQueries({ queryKey: balanceKeys.trip(tripId) });
      queryClient.invalidateQueries({ queryKey: totalsKeys.trip(tripId) });
    },
  });
}


