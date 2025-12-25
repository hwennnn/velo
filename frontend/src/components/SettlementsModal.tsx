/**
 * Settlements Modal Component
 * Modal showing settlement plan within the app container
 */
import { ArrowRight, CheckCircle2, X } from 'lucide-react';
import React from 'react';
import { useSettlements } from '../hooks/useBalances';
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
                        <div className="text-xs text-gray-500">{currency}</div>
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

                  {/* Payment Instructions */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      <strong>{settlement.from_nickname}</strong> pays{' '}
                      <strong>{settlement.to_nickname}</strong>{' '}
                      <strong className="text-primary-600">
                        {Number(settlement.amount).toFixed(2)} {currency}
                      </strong>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

