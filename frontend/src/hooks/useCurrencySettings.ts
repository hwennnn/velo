import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { POPULAR_CURRENCIES, SUPPORTED_CURRENCIES, type Currency } from '../config/currencies';

interface CurrencyState {
  preferredCurrencyCodes: string[];
  toggleCurrency: (code: string) => void;
  enableCurrency: (code: string) => void;
  disableCurrency: (code: string) => void;
  getPreferredCurrencies: () => Currency[];
}

export const useCurrencySettings = create<CurrencyState>()(
  persist(
    (set, get) => ({
      preferredCurrencyCodes: POPULAR_CURRENCIES,
      
      toggleCurrency: (code: string) => {
        set((state) => {
            const exists = state.preferredCurrencyCodes.includes(code);
            if (exists) {
                // Don't allow removing the last currency
                if (state.preferredCurrencyCodes.length <= 1) return state;
                return {
                    preferredCurrencyCodes: state.preferredCurrencyCodes.filter((c) => c !== code),
                };
            } else {
                return {
                    preferredCurrencyCodes: [...state.preferredCurrencyCodes, code],
                };
            }
        });
      },

      enableCurrency: (code: string) => {
        set((state) => {
            if (state.preferredCurrencyCodes.includes(code)) return state;
            return {
                preferredCurrencyCodes: [...state.preferredCurrencyCodes, code],
            };
        });
      },

      disableCurrency: (code: string) => {
        set((state) => {
            if (!state.preferredCurrencyCodes.includes(code)) return state;
            // Don't allow removing the last currency
            if (state.preferredCurrencyCodes.length <= 1) return state;
            return {
                preferredCurrencyCodes: state.preferredCurrencyCodes.filter((c) => c !== code),
            };
        });
      },

      getPreferredCurrencies: () => {
        const { preferredCurrencyCodes } = get();
        return SUPPORTED_CURRENCIES.filter((c) => preferredCurrencyCodes.includes(c.code));
      },
    }),
    {
      name: 'currency-settings', // name of the item in the storage (must be unique)
    }
  )
);
