/**
 * React Query hooks for Balance operations
 */
import { useMutation, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { api } from '../services/api';
import type { BalancesResponse, BulkConversionRequest, Debt } from '../types';

// Query Keys
export const balanceKeys = {
  all: ['balances'] as const,
  trip: (tripId: string) => [...balanceKeys.all, tripId] as const,
  settlements: (tripId: string) => [...balanceKeys.all, 'settlements', tripId] as const,
};

// Fetch balances for a trip (simplification is controlled by trip settings)
export function useBalances(tripId: string | undefined) : UseQueryResult<BalancesResponse> {
  return useQuery({
    queryKey: balanceKeys.trip(tripId!),
    queryFn: async () => {
      const response = await api.balances.get(tripId!);
      return response.data;
    },
    enabled: !!tripId,
  });
}

// Fetch settlements for a trip (now just returns debts)
export function useSettlements(tripId: string | undefined) : UseQueryResult<Debt[]> {
  return useQuery({
    queryKey: balanceKeys.settlements(tripId!),
    queryFn: async () => {
      const response = await api.balances.getSettlements(tripId!);
      return response.data.settlements;
    },
    enabled: !!tripId,
  });
}

// Create a settlement (creates a settlement expense)
export function useCreateSettlement(tripId: string) {
  return useMutation({
    mutationFn: async (settlementData: {
      from_member_id: number;
      to_member_id: number;
      amount: number;
      currency: string;
      settlement_date: string;
      notes?: string;
    }) => {
      const response = await api.balances.createSettlement(tripId, settlementData);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate balances and settlements
      queryClient.invalidateQueries({ queryKey: balanceKeys.trip(tripId) });
      queryClient.invalidateQueries({ queryKey: balanceKeys.settlements(tripId) });
      // Also invalidate expenses since settlement is an expense
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
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
      // Invalidate balances and settlements
      queryClient.invalidateQueries({ queryKey: balanceKeys.trip(tripId) });
      queryClient.invalidateQueries({ queryKey: balanceKeys.settlements(tripId) });
    },
  });
}

