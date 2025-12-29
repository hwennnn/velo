/**
 * Currency Settings Page
 * Allow users to manage their preferred currencies
 */
import { ArrowLeft, Check, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SUPPORTED_CURRENCIES } from '../config/currencies';
import { useCurrencySettings } from '../hooks/useCurrencySettings';

export default function CurrencySettingsPage() {
    const navigate = useNavigate();
    const { preferredCurrencyCodes, toggleCurrency } = useCurrencySettings();
    const [searchQuery, setSearchQuery] = useState('');

    // Filter currencies based on search
    const filteredCurrencies = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return SUPPORTED_CURRENCIES;

        return SUPPORTED_CURRENCIES.filter(
            (c) =>
                c.code.toLowerCase().includes(query) ||
                c.name.toLowerCase().includes(query) ||
                c.symbol.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    // Group currencies: Selected first, then others
    // Actually, keeping them alphabetical is probably better for a long list, 
    // but maybe sticky selected ones at top? 
    // Let's just list them and show checkmarks. A long list is fine with search.

    return (
        <div className="h-full bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white px-5 py-4 safe-top shadow-sm border-b border-gray-100 sticky top-0 z-10">
                <div className="flex items-center gap-3 mt-4 mb-2">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Currency Settings</h1>
                        <p className="text-sm text-gray-500">Manage your preferred currencies</p>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="mt-4 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search currencies..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500 transition-shadow"
                    />
                </div>
            </header>

            {/* List */}
            <main className="flex-1 overflow-y-auto p-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {filteredCurrencies.length > 0 ? (
                        filteredCurrencies.map((currency) => {
                            const isSelected = preferredCurrencyCodes.includes(currency.code);
                            return (
                                <button
                                    key={currency.code}
                                    onClick={() => toggleCurrency(currency.code)}
                                    className="w-full flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                                    ${isSelected ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {currency.code}
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-900">{currency.name}</div>
                                            <div className="text-sm text-gray-500">Symbol: {currency.symbol}</div>
                                        </div>
                                    </div>

                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                                ${isSelected
                                            ? 'bg-primary-600 border-primary-600'
                                            : 'border-gray-300'
                                        }`}>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                </button>
                            );
                        })
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            No currencies found matching "{searchQuery}"
                        </div>
                    )}
                </div>

                <p className="text-center text-xs text-gray-400 mt-6">
                    Selected currencies will appear in dropdowns across the app.
                </p>
            </main>
        </div>
    );
}
