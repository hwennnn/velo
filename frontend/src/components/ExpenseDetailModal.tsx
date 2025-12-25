/**
 * Expense Detail Modal Component
 * Shows detailed information about an expense in a modal
 */
import { format, parseISO } from 'date-fns';
import { Trash2, X } from 'lucide-react';
import React from 'react';
import type { Expense } from '../types';

interface ExpenseDetailModalProps {
  isOpen: boolean;
  expense: Expense | null;
  baseCurrency: string;
  currentUserId?: string;
  currentUserMemberId?: number;
  isCurrentUserAdmin?: boolean;
  onClose: () => void;
  onDelete: (expenseId: number) => void;
  deletingId: number | null;
}

const CATEGORIES = [
  { value: 'food', label: 'Food & Drinks', emoji: '🍽️' },
  { value: 'transport', label: 'Transport', emoji: '🚗' },
  { value: 'accommodation', label: 'Accommodation', emoji: '🏨' },
  { value: 'activities', label: 'Activities', emoji: '🎭' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { value: 'other', label: 'Other', emoji: '📦' },
];

export const ExpenseDetailModal: React.FC<ExpenseDetailModalProps> = ({
  isOpen,
  expense,
  baseCurrency,
  currentUserId,
  currentUserMemberId,
  isCurrentUserAdmin,
  onClose,
  onDelete,
  deletingId,
}) => {
  if (!isOpen || !expense) return null;

  const getCategoryEmoji = (category?: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    return cat?.emoji || '📦';
  };

  const isSettlement = expense.expense_type === 'settlement';

  // Calculate what the user needs to pay or will get back
  const calculateUserBalance = () => {
    if (currentUserMemberId === null || isSettlement) return null;

    const userSplit = expense.splits.find(s => s.member_id === currentUserMemberId);
    if (!userSplit) return null;

    const isPaidByUser = expense.paid_by_member_id === currentUserMemberId;
    
    if (isPaidByUser) {
      // User paid: they will get back (total - their share)
      const amountToGetBack = expense.amount - userSplit.amount;
      if (amountToGetBack <= 0) return null; // Don't show if nothing to get back
      
      return {
        type: 'get_back' as const,
        amount: amountToGetBack * expense.exchange_rate_to_base,
        amountInOriginal: amountToGetBack,
      };
    } else {
      // User didn't pay: they need to pay their share
      if (userSplit.amount <= 0) return null; // Don't show if nothing to pay
      
      return {
        type: 'pay_back' as const,
        amount: userSplit.amount * expense.exchange_rate_to_base,
        amountInOriginal: userSplit.amount,
      };
    }
  };

  const userBalance = calculateUserBalance();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-end justify-center sm:items-center">
        <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg transform transition-all">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isSettlement ? (
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
                    {getCategoryEmoji(expense.category)}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{expense.description}</h2>
                  <p className="text-sm text-gray-500">
                    {format(parseISO(expense.expense_date), 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Amount Card */}
            <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-primary-700 font-medium">Total Amount</span>
                {expense.category && (
                  <span className="text-xs bg-white/50 px-2 py-1 rounded-full text-primary-700">
                    {expense.category}
                  </span>
                )}
              </div>
              <div className="text-3xl font-bold text-primary-900">
                {expense.currency} {Number(expense.amount).toFixed(2)}
              </div>
              <div className="text-sm text-primary-700 mt-1">
                Paid by {expense.paid_by_nickname}
              </div>
            </div>

            {/* User Balance - What they need to pay or will get back */}
            {userBalance && (
              <div className={`rounded-xl p-4 ${
                userBalance.type === 'get_back' 
                  ? 'bg-green-50 border-2 border-green-200' 
                  : 'bg-red-50 border-2 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className={`text-sm font-semibold mb-1 ${
                      userBalance.type === 'get_back' ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {userBalance.type === 'get_back' ? 'You will get back' : 'You need to pay back'}
                    </h3>
                    <p className={`text-xs ${
                      userBalance.type === 'get_back' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {userBalance.type === 'get_back' 
                        ? `${expense.paid_by_nickname === 'You' ? 'You' : expense.paid_by_nickname} paid for others`
                        : `Your share of the expense`
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${
                      userBalance.type === 'get_back' ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {expense.currency} {Number(userBalance.amountInOriginal).toFixed(2)}
                    </div>
                    {expense.currency !== baseCurrency && (
                      <div className={`text-sm ${
                        userBalance.type === 'get_back' ? 'text-green-700' : 'text-red-700'
                      }`}>
                        ≈ {baseCurrency} {Number(userBalance.amount).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Currency Conversion Info */}
            {expense.currency !== baseCurrency && (
              <div className="bg-blue-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Currency Conversion</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Original Amount:</span>
                    <span className="font-semibold text-gray-900">
                      {expense.currency} {Number(expense.amount).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Converted to {baseCurrency}:</span>
                    <span className="font-semibold text-gray-900">
                      {baseCurrency} {Number(expense.amount_in_base_currency).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 pt-2 border-t border-blue-100">
                    Exchange Rate: 1 {expense.currency} = {Number(expense.exchange_rate_to_base).toFixed(4)} {baseCurrency}
                  </div>
                </div>
              </div>
            )}

            {/* Split Details */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Split Between</h3>
              <div className="space-y-2">
                {expense.splits.map((split) => (
                  <div
                    key={split.id}
                    className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0"
                  >
                    <span className="text-sm font-medium text-gray-900">{split.member_nickname}</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        {expense.currency} {Number(split.amount).toFixed(2)}
                      </span>
                      {split.percentage && (
                        <span className="text-xs text-gray-500 ml-2">
                          ({Number(split.percentage).toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {expense.notes && (
              <div className="bg-amber-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{expense.notes}</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {currentUserId && (expense.created_by === currentUserId || isCurrentUserAdmin) && (
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-4 rounded-b-2xl">
              <button
                onClick={() => onDelete(expense.id)}
                disabled={deletingId === expense.id}
                className="w-full px-4 py-3 bg-red-50 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deletingId === expense.id ? 'Deleting...' : 'Delete Expense'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

