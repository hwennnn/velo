/**
 * Balances Modal Component
 * Full-screen modal showing member balances
 */
import { ArrowLeft, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import React from 'react';
import { Shimmer } from './Shimmer';

interface Balance {
  member_id: number;
  member_nickname: string;
  total_paid: number;
  total_owed: number;
  net_balance: number;
}

interface BalancesModalProps {
  isOpen: boolean;
  balances: Balance[];
  isLoading: boolean;
  currency: string;
  getMemberColor: (memberId: number) => string;
  onClose: () => void;
}

export const BalancesModal: React.FC<BalancesModalProps> = ({
  isOpen,
  balances,
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
            aria-label="Close balances"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-gray-900">Member Balances</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          // Loading skeleton with shimmer
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <Shimmer className="w-12 h-12 rounded-full" />
                    <div className="flex-1">
                      <Shimmer className="h-4 rounded w-24 mb-2" />
                      <Shimmer className="h-3 rounded w-32" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Shimmer className="h-6 rounded w-16 mb-1" />
                    <Shimmer className="h-3 rounded w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {balances.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No balance data available</p>
              </div>
            ) : (
              balances.map((balance) => {
                const colorClass = getMemberColor(balance.member_id);
                return (
                  <div
                    key={balance.member_id}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-12 h-12 rounded-full ${colorClass} flex items-center justify-center`}>
                          <span className="text-white font-semibold">
                            {balance.member_nickname.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{balance.member_nickname}</h4>
                          <div className="flex gap-4 mt-1 text-xs text-gray-500">
                            <span>Paid: {Number(balance.total_paid).toFixed(2)}</span>
                            <span>Owes: {Number(balance.total_owed).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-xl font-bold ${
                            balance.net_balance > 0.01
                              ? 'text-green-600'
                              : balance.net_balance < -0.01
                              ? 'text-red-600'
                              : 'text-gray-500'
                          }`}
                        >
                          {balance.net_balance > 0.01 ? '+' : ''}
                          {Number(balance.net_balance).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{currency}</div>
                        {balance.net_balance > 0.01 && (
                          <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>Gets back</span>
                          </div>
                        )}
                        {balance.net_balance < -0.01 && (
                          <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                            <TrendingDown className="w-3 h-3" />
                            <span>Owes</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
};

