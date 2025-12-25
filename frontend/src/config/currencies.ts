/**
 * Currency configuration for the Velo application.
 * Defines supported currencies with their symbols and names.
 */

export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

// Mainstream supported currencies - matches backend configuration
export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
];

// Default currency
export const DEFAULT_CURRENCY = 'USD';

// Create lookup maps for easy access
export const CURRENCY_MAP = new Map(
  SUPPORTED_CURRENCIES.map(currency => [currency.code, currency])
);

export const CURRENCY_CODES = SUPPORTED_CURRENCIES.map(currency => currency.code);

/**
 * Check if a currency code is supported
 */
export function isSupportedCurrency(currencyCode: string): boolean {
  return CURRENCY_MAP.has(currencyCode.toUpperCase());
}

/**
 * Get currency information by code
 */
export function getCurrencyInfo(currencyCode: string): Currency {
  const currency = CURRENCY_MAP.get(currencyCode.toUpperCase());
  if (!currency) {
    throw new Error(`Unsupported currency: ${currencyCode}`);
  }
  return currency;
}

/**
 * Get currency symbol by code
 */
export function getCurrencySymbol(currencyCode: string): string {
  return getCurrencyInfo(currencyCode).symbol;
}

/**
 * Get currency name by code
 */
export function getCurrencyName(currencyCode: string): string {
  return getCurrencyInfo(currencyCode).name;
}
