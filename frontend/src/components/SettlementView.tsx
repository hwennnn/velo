/**
 * SettlementView Component
 * 
 * Displays balances and optimal settlement plan for a trip.
 */
import React, { useState } from 'react';
import { TrendingUp, TrendingDown, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useBalances, useSettlements } from '../hooks/useBalances';
import { LoadingSpinner } from './LoadingSpinner';
import type { TripMember } from '../types';

interface Balance {
  member_id: number;
  member_nickname: string;
  total_paid: number;
  total_owed: number;
  net_balance: number;
}

interface Settlement {
  from_member_id: number;
  to_member_id: number;
  amount: number;
  from_nickname: string;
  to_nickname: string;
}

interface SettlementViewProps {
  tripId: string;
  members: TripMember[];
  baseCurrency: string;
}

export const SettlementView: React.FC<SettlementViewProps> = ({
  tripId,
  members,
  baseCurrency,
}) => {
  const [showBalances, setShowBalances] = useState(true);

  // Use React Query hooks
  const { data: balances = [], isLoading: balancesLoading, error: balancesError } = useBalances(tripId);
  const { data: settlements = [], isLoading: settlementsLoading, error: settlementsError } = useSettlements(tripId);

  const isLoading = balancesLoading || settlementsLoading;
  const error = balancesError || settlementsError;

  const getMemberColor = (memberId: number) => {
    const index = members.findIndex((m) => m.id === memberId);
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-teal-500',
    ];
    return colors[index % colors.length];
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 flex justify-center">
        <LoadingSpinner size="md" text="Loading balances..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <p>{String(error)}</p>
        </div>
      </div>
    );
  }

  const isSettled = settlements.length === 0;

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowBalances(true)}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
            showBalances
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Balances
        </button>
        <button
          onClick={() => setShowBalances(false)}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
            !showBalances
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Settlements
        </button>
      </div>

      {showBalances ? (
        /* Balances View */
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Member Balances</h3>
            <span className="text-sm text-gray-500">{balances.length} members</span>
          </div>

          {balances.map((balance) => (
            <div
              key={balance.member_id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-10 h-10 rounded-full ${getMemberColor(balance.member_id)} flex items-center justify-center`}>
                    <span className="text-white font-semibold text-sm">
                      {balance.member_nickname.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{balance.member_nickname}</h4>
                    <div className="flex gap-4 mt-1 text-xs text-gray-500">
                      <span>Paid: {balance.total_paid.toFixed(2)}</span>
                      <span>Owes: {balance.total_owed.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-lg font-bold ${
                      balance.net_balance > 0.01
                        ? 'text-green-600'
                        : balance.net_balance < -0.01
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {balance.net_balance > 0.01 ? '+' : ''}
                    {balance.net_balance.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{baseCurrency}</div>
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
          ))}
        </div>
      ) : (
        /* Settlements View */
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Settlement Plan</h3>
            {isSettled && (
              <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                All Settled
              </span>
            )}
          </div>

          {isSettled ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h4 className="text-lg font-semibold text-gray-900 mb-1">
                All Balanced!
              </h4>
              <p className="text-sm text-gray-600">
                All expenses are settled. No payments needed.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>{settlements.length}</strong> payment{settlements.length !== 1 ? 's' : ''} needed to settle all expenses
                </p>
              </div>

              {settlements.map((settlement, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    {/* From Member */}
                    <div className="flex items-center gap-2 flex-1">
                      <div className={`w-10 h-10 rounded-full ${getMemberColor(settlement.from_member_id)} flex items-center justify-center`}>
                        <span className="text-white font-semibold text-sm">
                          {settlement.from_nickname.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">{settlement.from_nickname}</span>
                    </div>

                    {/* Arrow and Amount */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 text-primary-600">
                        <ArrowRight className="w-5 h-5" />
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900">
                          {settlement.amount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">{baseCurrency}</div>
                      </div>
                    </div>

                    {/* To Member */}
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className="font-medium text-gray-900">{settlement.to_nickname}</span>
                      <div className={`w-10 h-10 rounded-full ${getMemberColor(settlement.to_member_id)} flex items-center justify-center`}>
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
                        {settlement.amount.toFixed(2)} {baseCurrency}
                      </strong>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

