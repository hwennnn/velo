/**
 * React Query hook for Totals operations
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '../services/api';
import type { TotalsResponse } from '../types';

// Query Keys
export const totalsKeys = {
  all: ['totals'] as const,
  trip: (tripId: string) => [...totalsKeys.all, tripId] as const,
};

/**
 * Fetch spending totals for a trip
 * Shows how much each person paid vs their fair share
 */
export function useTotals(tripId: string | undefined): UseQueryResult<TotalsResponse> {
  return useQuery({
    queryKey: totalsKeys.trip(tripId!),
    queryFn: async () => {
      const response = await api.balances.getTotals(tripId!);
      return response.data;
    },
    enabled: !!tripId,
  });
}
