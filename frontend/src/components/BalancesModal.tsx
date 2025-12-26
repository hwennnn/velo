/**
 * Balances Modal Component
 * Modal showing member balances with multi-currency breakdown
 */
import { ChevronDown, ChevronUp, DollarSign, TrendingDown, TrendingUp, X } from 'lucide-react';
import React, { useState } from 'react';
import { useBalances } from '../hooks/useBalances';
import { useTrip } from '../hooks/useTrips';
import { Avatar } from './Avatar';
import { Shimmer } from './Shimmer';

interface BalancesModalProps {
  isOpen: boolean;
  tripId: string;
  currency: string;
  getMemberColor: (memberId: number) => string;
  onClose: () => void;
}

export const BalancesModal: React.FC<BalancesModalProps> = ({
  isOpen,
  tripId,
  currency,
  getMemberColor,
  onClose,
}) => {
  // Fetch balances only when modal is open
  const { data: balances = [], isLoading } = useBalances(isOpen ? tripId : undefined);
  const { data: trip } = useTrip(isOpen ? tripId : undefined);
  const [expandedMembers, setExpandedMembers] = useState<Set<number>>(new Set());

  const toggleMemberExpansion = (memberId: number) => {
    setExpandedMembers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
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
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-semibold text-gray-900">Member Balances</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Totals shown in {currency} (base currency). Expand for per-currency breakdown.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
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
                const fallbackColorClass = getMemberColor(balance.member_id);
                const isExpanded = expandedMembers.has(balance.member_id);
                const hasCurrencyBreakdown = balance.currency_balances && 
                  Object.keys(balance.currency_balances).length > 0;
                const member = trip?.members?.find((m) => m.id === balance.member_id);
                
                return (
                  <div
                    key={balance.member_id}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar
                            size="md"
                            className="w-12 h-12"
                            fallbackColorClass={fallbackColorClass}
                            member={{
                              id: balance.member_id,
                              nickname: member?.nickname ?? balance.member_nickname,
                              display_name: member?.display_name,
                              avatar_url: member?.avatar_url,
                            }}
                          />
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{balance.member_nickname}</h4>
                            <div className="flex gap-4 mt-1 text-xs text-gray-500">
                              <span>Owed by others: {Number(balance.total_owed_to).toFixed(2)} {currency}</span>
                              <span>Owed to others: {Number(balance.total_owed).toFixed(2)} {currency}</span>
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

                      {/* Currency breakdown toggle */}
                      {hasCurrencyBreakdown && (
                        <button
                          onClick={() => toggleMemberExpansion(balance.member_id)}
                          className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-primary-600 hover:text-primary-700 transition-colors"
                        >
                          <span>
                            {isExpanded ? 'Hide' : 'Show'} currency breakdown
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Currency breakdown section */}
                    {hasCurrencyBreakdown && isExpanded && (
                      <div className="border-t border-gray-200 bg-gray-50 p-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-3">
                          Balance by Currency
                        </h5>
                        <div className="space-y-2">
                          {Object.entries(balance.currency_balances!).map(([curr, amount]) => (
                            <div
                              key={curr}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-gray-600 font-medium">{curr}</span>
                              <span
                                className={`font-semibold ${
                                  amount > 0.01
                                    ? 'text-green-600'
                                    : amount < -0.01
                                    ? 'text-red-600'
                                    : 'text-gray-500'
                                }`}
                              >
                                {amount > 0.01 ? '+' : ''}
                                {Number(amount).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-xs text-gray-500 italic">
                          Positive = gets back, Negative = owes
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

