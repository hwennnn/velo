/**
 * Settlements Modal Component
 * Modal showing settlement plan with multi-currency support and recording
 * Supports currency conversion for settlements
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, CheckCircle2, RefreshCw, X } from 'lucide-react';
import React, { useState } from 'react';
import { SUPPORTED_CURRENCIES } from '../config/currencies';
import { useAlert } from '../contexts/AlertContext';
import { balanceKeys, useSettlements } from '../hooks/useBalances';
import { api } from '../services/api';
import type { Settlement, SettlementInput } from '../types';
import { Shimmer } from './Shimmer';


interface SettlementsModalProps {
  isOpen: boolean;
  tripId: string;
  currency: string;
  getMemberColor: (memberId: number) => string;
  onClose: () => void;
}

export const SettlementsModal: React.FC<SettlementsModalProps> = ({
  isOpen,
  tripId,
  currency,
  getMemberColor,
  onClose,
}) => {
  // Fetch settlements only when modal is open
  const { data: settlements = [], isLoading } = useSettlements(isOpen ? tripId : undefined);
  const [recordingSettlements, setRecordingSettlements] = useState<Set<string>>(new Set());
  const [showConversionModal, setShowConversionModal] = useState<Settlement | null>(null);
  const [convertToCurrency, setConvertToCurrency] = useState<string>('');
  const [conversionRate, setConversionRate] = useState<string>('');
  const queryClient = useQueryClient();
  const { showAlert } = useAlert();

  // Mutation for recording settlements
  const recordSettlementMutation = useMutation({
    mutationFn: (settlementData: SettlementInput) => 
      api.balances.recordSettlement(tripId, settlementData),
    onSuccess: () => {
      // Invalidate and refetch balances and settlements
      queryClient.invalidateQueries({ queryKey: balanceKeys.trip(tripId) });
      queryClient.invalidateQueries({ queryKey: balanceKeys.settlements(tripId) });
      showAlert('Settlement recorded successfully', 'success');
    },
    onError: (error: any) => {
      showAlert(
        error.response?.data?.detail || 'Failed to record settlement',
        'error'
      );
    },
  });

  const handleRecordSettlement = async (settlement: Settlement, withConversion?: boolean) => {
    const settlementKey = `${settlement.from_member_id}-${settlement.to_member_id}-${settlement.currency}`;
    
    if (recordingSettlements.has(settlementKey)) {
      return; // Already recording
    }

    setRecordingSettlements(prev => new Set(prev).add(settlementKey));

    try {
      const settlementData: SettlementInput = {
        from_member_id: settlement.from_member_id,
        to_member_id: settlement.to_member_id,
        amount: settlement.amount,
        currency: settlement.currency,
        settlement_date: new Date().toISOString().split('T')[0],
        notes: `Settlement: ${settlement.from_nickname} → ${settlement.to_nickname}`,
      };

      // Add conversion if specified
      if (withConversion && convertToCurrency && conversionRate) {
        settlementData.convert_to_currency = convertToCurrency;
        settlementData.conversion_rate = parseFloat(conversionRate);
      }

      await recordSettlementMutation.mutateAsync(settlementData);
      setShowConversionModal(null);
      setConvertToCurrency('');
      setConversionRate('');
    } finally {
      setRecordingSettlements(prev => {
        const newSet = new Set(prev);
        newSet.delete(settlementKey);
        return newSet;
      });
    }
  };

  const handleShowConversionModal = (settlement: Settlement) => {
    setShowConversionModal(settlement);
    setConvertToCurrency(currency); // Default to base currency
    setConversionRate('1.0');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl animate-slideUp sm:animate-fadeIn max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Settlement Plan</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          // Loading skeleton with shimmer
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <Shimmer className="h-4 rounded w-48" />
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Shimmer className="w-10 h-10 rounded-full" />
                    <Shimmer className="h-4 rounded w-20" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Shimmer className="w-5 h-5 rounded" />
                    <Shimmer className="h-5 rounded w-16" />
                  </div>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <Shimmer className="h-4 rounded w-20" />
                    <Shimmer className="w-10 h-10 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : settlements.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h4 className="text-xl font-semibold text-gray-900 mb-2">All Balanced!</h4>
            <p className="text-gray-600">All expenses are settled. No payments needed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-900">
                <strong>{settlements.length}</strong> payment{settlements.length !== 1 ? 's' : ''}{' '}
                needed to settle all expenses
              </p>
            </div>

            {settlements.map((settlement, index) => {
              const fromColor = getMemberColor(settlement.from_member_id);
              const toColor = getMemberColor(settlement.to_member_id);
              const settlementKey = `${settlement.from_member_id}-${settlement.to_member_id}-${settlement.currency}`;
              const isRecording = recordingSettlements.has(settlementKey);
              
              return (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    {/* From Member */}
                    <div className="flex items-center gap-2 flex-1">
                      <div className={`w-10 h-10 rounded-full ${fromColor} flex items-center justify-center`}>
                        <span className="text-white font-semibold text-sm">
                          {settlement.from_nickname.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{settlement.from_nickname}</span>
                    </div>

                    {/* Arrow and Amount */}
                    <div className="flex flex-col items-center gap-1">
                      <ArrowRight className="w-5 h-5 text-primary-600" />
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900">
                          {Number(settlement.amount).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">{settlement.currency}</div>
                      </div>
                    </div>

                    {/* To Member */}
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className="font-medium text-gray-900 text-sm">{settlement.to_nickname}</span>
                      <div className={`w-10 h-10 rounded-full ${toColor} flex items-center justify-center`}>
                        <span className="text-white font-semibold text-sm">
                          {settlement.to_nickname.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Instructions and Record Buttons */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>{settlement.from_nickname}</strong> pays{' '}
                      <strong>{settlement.to_nickname}</strong>{' '}
                      <strong className="text-primary-600">
                        {Number(settlement.amount).toFixed(2)} {settlement.currency}
                      </strong>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRecordSettlement(settlement, false)}
                        disabled={isRecording}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                        title="Mark as paid in original currency"
                      >
                        {isRecording ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Recording...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Paid</span>
                          </>
                        )}
                      </button>
                      {settlement.currency !== currency && (
                        <button
                          onClick={() => handleShowConversionModal(settlement)}
                          disabled={isRecording}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                          title="Pay in different currency"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* Currency Conversion Modal */}
      {showConversionModal && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Pay in Different Currency
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Settling <strong>{Number(showConversionModal.amount).toFixed(2)} {showConversionModal.currency}</strong> debt
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pay in Currency
                </label>
                <select
                  value={convertToCurrency}
                  onChange={(e) => setConvertToCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {SUPPORTED_CURRENCIES.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conversion Rate (1 {showConversionModal.currency} = ? {convertToCurrency})
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={conversionRate}
                  onChange={(e) => setConversionRate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., 0.0067"
                />
              </div>

              {conversionRate && parseFloat(conversionRate) > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900">
                    You will pay: <strong>
                      {(showConversionModal.amount * parseFloat(conversionRate)).toFixed(2)} {convertToCurrency}
                    </strong>
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowConversionModal(null);
                  setConvertToCurrency('');
                  setConversionRate('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRecordSettlement(showConversionModal, true)}
                disabled={!conversionRate || parseFloat(conversionRate) <= 0}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

