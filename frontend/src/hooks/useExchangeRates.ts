/**
 * React Query hook for fetching exchange rates
 * Uses long stale time (30 minutes) to minimize API calls
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '../services/api';

export interface ExchangeRates {
  base_currency: string;
  rates: Record<string, number>;
}

// Query Keys
export const exchangeRateKeys = {
  all: ['exchangeRates'] as const,
  base: (baseCurrency: string) => [...exchangeRateKeys.all, baseCurrency] as const,
};

/**
 * Fetch exchange rates for a base currency
 * Results are cached for 30 minutes (staleTime)
 * Data remains in cache for 1 hour (gcTime)
 */
export function useExchangeRates(
  baseCurrency: string | undefined
): UseQueryResult<ExchangeRates> {
  return useQuery({
    queryKey: exchangeRateKeys.base(baseCurrency!),
    queryFn: async () => {
      const response = await api.exchangeRates.get(baseCurrency!);
      return response.data;
    },
    enabled: !!baseCurrency,
    staleTime: 30 * 60 * 1000, // 30 minutes - data is considered fresh
    gcTime: 60 * 60 * 1000, // 1 hour - cache retention time
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on component mount if data is fresh
  });
}

/**
 * Calculate exchange rate between two currencies using base rates
 */
export function calculateCrossRate(
  fromCurrency: string,
  toCurrency: string,
  baseRates: Record<string, number>,
  baseCurrency: string
): number {
  if (fromCurrency === toCurrency) return 1;

  // If base currency is involved, direct conversion
  if (fromCurrency === baseCurrency) {
    return baseRates[toCurrency] || 1;
  }
  if (toCurrency === baseCurrency) {
    return 1 / (baseRates[fromCurrency] || 1);
  }

  // Cross rate: from -> base -> to
  const fromToBase = baseRates[fromCurrency] || 1;
  const toToBase = baseRates[toCurrency] || 1;
  
  // Convert from -> base, then base -> to
  return toToBase / fromToBase;
}

/**
 * Convert an amount from one currency to another
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  baseRates: Record<string, number>,
  baseCurrency: string
): number {
  const rate = calculateCrossRate(fromCurrency, toCurrency, baseRates, baseCurrency);
  return amount * rate;
}

