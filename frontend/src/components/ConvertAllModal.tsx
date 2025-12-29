/**
 * Convert All Debts Modal
 * 
 * Allows users to convert all debts to the base currency with customizable rates.
 * Shows a full-page overlay to block other actions during conversion.
 */
import { RefreshCw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Debt } from '../types';

interface ConvertAllModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConvert: (customRates: Record<string, number>) => Promise<void>;
    debts: Debt[];
    baseCurrency: string;
    exchangeRates: Record<string, number>;
    isConverting: boolean;
}

export function ConvertAllModal({
    isOpen,
    onClose,
    onConvert,
    debts,
    baseCurrency,
    exchangeRates,
    isConverting,
}: ConvertAllModalProps) {
    // Get unique currencies (excluding base currency)
    const currenciesToConvert = useMemo(() => [...new Set(debts.map(d => d.currency).filter(c => c !== baseCurrency))], [debts, baseCurrency]);

    // Initialize rates from exchange rates
    const [customRates, setCustomRates] = useState<Record<string, string>>({});
    const prevIsOpenRef = useRef(isOpen);

    useEffect(() => {
        // Only update rates when modal transitions from closed to open
        if (isOpen && !prevIsOpenRef.current) {
            const initialRates: Record<string, string> = {};
            currenciesToConvert.forEach(currency => {
                // Calculate rate from base to this currency, then invert for conversion
                const rateFromBase = exchangeRates[currency] || 1;
                const rateToBase = rateFromBase > 0 ? (1 / rateFromBase) : 1;
                initialRates[currency] = rateToBase.toString();
            });
            // Use setTimeout to avoid synchronous setState in effect
            setTimeout(() => setCustomRates(initialRates), 0);
        }
        prevIsOpenRef.current = isOpen;
    }, [isOpen, currenciesToConvert, exchangeRates]);

    const handleRateChange = (currency: string, value: string) => {
        setCustomRates(prev => ({ ...prev, [currency]: value }));
    };

    const handleConvert = async () => {
        const rates: Record<string, number> = {};
        Object.entries(customRates).forEach(([currency, rate]) => {
            const parsed = parseFloat(rate);
            if (!isNaN(parsed) && parsed > 0) {
                rates[currency] = parsed;
            }
        });
        await onConvert(rates);
    };

    // Calculate total amounts per currency
    const amountsByCurrency: Record<string, number> = {};
    debts.forEach(d => {
        if (d.currency !== baseCurrency) {
            amountsByCurrency[d.currency] = (amountsByCurrency[d.currency] || 0) + d.amount;
        }
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop - blocks all interaction */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={isConverting ? undefined : onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Convert All Debts</h3>
                        <p className="text-sm text-gray-500">Convert to {baseCurrency}</p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isConverting}
                        className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center disabled:opacity-50"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {currenciesToConvert.length === 0 ? (
                        <div className="text-center py-6 text-gray-500">
                            All debts are already in {baseCurrency}.
                        </div>
                    ) : (
                        <>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                                <strong>Note:</strong> This will convert all debts to {baseCurrency}.
                                You can adjust the exchange rates below before converting.
                            </div>

                            <div className="space-y-3">
                                {currenciesToConvert.map(currency => {
                                    const amount = amountsByCurrency[currency] || 0;
                                    const rate = parseFloat(customRates[currency] || '1');
                                    const convertedAmount = isNaN(rate) ? amount : amount * rate;

                                    return (
                                        <div key={currency} className="bg-gray-50 rounded-lg p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-semibold text-gray-900">{currency}</div>
                                                    <div className="text-sm text-gray-500">
                                                        Total: {amount.toFixed(2)} {currency}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-gray-400">Converts to (approx)</div>
                                                    <div className="font-semibold text-primary-600">
                                                        ≈ {convertedAmount.toFixed(2)} {baseCurrency}
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    Rate (1 {currency} = ? {baseCurrency})
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.000001"
                                                    value={customRates[currency] || ''}
                                                    onChange={(e) => handleRateChange(currency, e.target.value)}
                                                    disabled={isConverting}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                                                    placeholder="Enter rate..."
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isConverting}
                        className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConvert}
                        disabled={isConverting || currenciesToConvert.length === 0}
                        className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                    >
                        {isConverting ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Converting...
                            </>
                        ) : (
                            `Convert to ${baseCurrency}`
                        )}
                    </button>
                </div>
            </div>

            {/* Full page loading overlay when converting */}
            {isConverting && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                    <div className="text-center">
                        <RefreshCw className="w-10 h-10 text-primary-600 animate-spin mx-auto mb-3" />
                        <div className="text-lg font-semibold text-gray-900">Converting debts...</div>
                        <div className="text-sm text-gray-500">Please wait, do not close this page.</div>
                    </div>
                </div>
            )}
        </div>
    );
}
