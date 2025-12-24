/**
 * Action Chips Component
 * Displays action buttons for Balances and Settle Up
 */
import { DollarSign, Receipt } from 'lucide-react';
import React from 'react';

interface ActionChipsProps {
  onBalancesClick: () => void;
  onSettlementsClick: () => void;
}

export const ActionChips: React.FC<ActionChipsProps> = ({
  onBalancesClick,
  onSettlementsClick,
}) => {
  return (
    <div className="p-4 flex gap-2">
      <button
        onClick={onBalancesClick}
        className="flex-1 bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 border border-gray-200"
      >
        <DollarSign className="w-4 h-4 text-primary-600" />
        <span className="text-sm font-medium text-gray-900">Balances</span>
      </button>
      <button
        onClick={onSettlementsClick}
        className="flex-1 bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 border border-gray-200"
      >
        <Receipt className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium text-gray-900">Settle Up</span>
      </button>
    </div>
  );
};

