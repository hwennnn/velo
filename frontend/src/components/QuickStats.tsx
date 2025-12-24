/**
 * Quick Stats Component
 * Displays expense count, total spent, and action chips
 */
import { DollarSign, Receipt } from 'lucide-react';
import React from 'react';

interface QuickStatsProps {
  expenseCount: number;
  totalSpent: number;
  currency: string;
  onBalancesClick: () => void;
  onSettlementsClick: () => void;
}

export const QuickStats: React.FC<QuickStatsProps> = ({
  expenseCount,
  totalSpent,
  currency,
  onBalancesClick,
  onSettlementsClick,
}) => {
  return (
    <div className="p-4 space-y-3">
      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{expenseCount}</div>
          <div className="text-xs text-gray-600 mt-1">Expenses</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">
            {currency} {Number(totalSpent).toFixed(0)}
          </div>
          <div className="text-xs text-gray-600 mt-1">Total Spent</div>
        </div>
      </div>

      {/* Action Chips Row */}
      <div className="flex gap-2">
        <button
          onClick={onBalancesClick}
          className="flex-1 bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
        >
          <DollarSign className="w-4 h-4 text-primary-600" />
          <span className="text-sm font-medium text-gray-900">Balances</span>
        </button>
        <button
          onClick={onSettlementsClick}
          className="flex-1 bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
        >
          <Receipt className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-gray-900">Settle Up</span>
        </button>
      </div>
    </div>
  );
};

