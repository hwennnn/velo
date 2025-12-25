/**
 * Utility functions for settlement grouping and management
 */
import type { Settlement, GroupedSettlement } from '../types';

/**
 * Group settlements by payer -> payee pairs across all currencies
 * This allows users to see all debts between two people in one place
 */
export function groupSettlementsByPair(
  settlements: Settlement[],
  baseCurrency: string,
  exchangeRates: Record<string, number> = {}
): GroupedSettlement[] {
  const grouped = new Map<string, GroupedSettlement>();

  for (const settlement of settlements) {
    // Create a unique key for this pair
    const pairKey = `${settlement.from_member_id}-${settlement.to_member_id}`;

    if (!grouped.has(pairKey)) {
      grouped.set(pairKey, {
        from_member_id: settlement.from_member_id,
        to_member_id: settlement.to_member_id,
        from_nickname: settlement.from_nickname,
        to_nickname: settlement.to_nickname,
        settlements: [],
        total_in_base: 0,
      });
    }

    const group = grouped.get(pairKey)!;
    group.settlements.push(settlement);

    // Calculate total in base currency
    const rate = exchangeRates[settlement.currency] || 1;
    group.total_in_base += settlement.amount * rate;
  }

  return Array.from(grouped.values());
}

/**
 * Calculate the exchange rate between two currencies
 * using base currency as intermediary
 */
export function calculateExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  baseCurrency: string,
  exchangeRates: Record<string, number>
): number {
  if (fromCurrency === toCurrency) return 1;

  // Get rates to base currency
  const fromToBase = exchangeRates[fromCurrency] || 1;
  const toToBase = exchangeRates[toCurrency] || 1;

  // Calculate cross rate: from -> base -> to
  return toToBase / fromToBase;
}

/**
 * Merge a settlement from one currency to another
 * This is useful for consolidating debts in a single currency
 */
export function mergeSettlementCurrency(
  settlement: Settlement,
  targetCurrency: string,
  exchangeRate: number
): Settlement {
  return {
    ...settlement,
    amount: settlement.amount * exchangeRate,
    currency: targetCurrency,
  };
}

/**
 * Calculate the total amount for a group in a specific currency
 */
export function calculateGroupTotalInCurrency(
  group: GroupedSettlement,
  targetCurrency: string,
  baseCurrency: string,
  exchangeRates: Record<string, number>
): number {
  let total = 0;

  for (const settlement of group.settlements) {
    const rate = calculateExchangeRate(
      settlement.currency,
      targetCurrency,
      baseCurrency,
      exchangeRates
    );
    total += settlement.amount * rate;
  }

  return total;
}

