/**
 * React Query hooks for Balance operations
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

// Query Keys
export const balanceKeys = {
  all: ['balances'] as const,
  trip: (tripId: string) => [...balanceKeys.all, tripId] as const,
  settlements: (tripId: string) => [...balanceKeys.all, 'settlements', tripId] as const,
};

// Fetch balances for a trip
export function useBalances(tripId: string | undefined) {
  return useQuery({
    queryKey: balanceKeys.trip(tripId!),
    queryFn: async () => {
      const response = await api.balances.get(tripId!);
      return response.data.balances;
    },
    enabled: !!tripId,
  });
}

// Fetch settlements for a trip
export function useSettlements(tripId: string | undefined) {
  return useQuery({
    queryKey: balanceKeys.settlements(tripId!),
    queryFn: async () => {
      const response = await api.balances.getSettlements(tripId!);
      return response.data.settlements;
    },
    enabled: !!tripId,
  });
}

