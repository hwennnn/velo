/**
 * Settlements Modal Component
 * Full-screen modal showing settlement plan
 */
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import React from 'react';
import { Shimmer } from './Shimmer';

interface Settlement {
  from_member_id: number;
  to_member_id: number;
  amount: number;
  from_nickname: string;
  to_nickname: string;
}

interface SettlementsModalProps {
  isOpen: boolean;
  settlements: Settlement[];
  isLoading: boolean;
  currency: string;
  getMemberColor: (memberId: number) => string;
  onClose: () => void;
}

export const SettlementsModal: React.FC<SettlementsModalProps> = ({
  isOpen,
  settlements,
  isLoading,
  currency,
  getMemberColor,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-50">
      {/* Header */}
      <header className="bg-white px-4 py-3 border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            aria-label="Close settlements"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-gray-900">Settlement Plan</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4">
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
      </main>
    </div>
  );
};

