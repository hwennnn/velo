/**
 * ExpenseList Component
 * 
 * Displays a list of expenses grouped by date with timeline headers.
 */
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { Calendar, ChevronDown, Filter, Receipt, Tag, Trash2, User } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useAlert } from '../contexts/AlertContext';
import type { Expense, TripMember } from '../types';

interface ExpenseListProps {
  expenses: Expense[];
  members: TripMember[];
  baseCurrency: string;
  currentUserId?: string;
  isCurrentUserAdmin?: boolean;
  selectedCategory: string;
  selectedMember: number | null;
  onDelete: (expenseId: number) => Promise<void>;
  onRefresh: () => void;
  onFilterClick: () => void;
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories', emoji: '📦' },
  { value: 'food', label: 'Food & Drinks', emoji: '🍽️' },
  { value: 'transport', label: 'Transport', emoji: '🚗' },
  { value: 'accommodation', label: 'Accommodation', emoji: '🏨' },
  { value: 'activities', label: 'Activities', emoji: '🎭' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { value: 'other', label: 'Other', emoji: '📦' },
];

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  baseCurrency,
  currentUserId,
  isCurrentUserAdmin = false,
  selectedCategory,
  selectedMember,
  onDelete,
  onRefresh,
  onFilterClick,
}) => {
  const { showAlert, showConfirm } = useAlert();
  const [expandedExpense, setExpandedExpense] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      if (selectedCategory !== 'all' && expense.category !== selectedCategory) {
        return false;
      }
      if (selectedMember !== null && expense.paid_by_member_id !== selectedMember) {
        return false;
      }
      return true;
    });
  }, [expenses, selectedCategory, selectedMember]);

  // Group expenses by date
  const groupedExpenses = useMemo(() => {
    const groups: { [key: string]: Expense[] } = {};
    
    filteredExpenses.forEach((expense) => {
      const date = format(parseISO(expense.expense_date), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(expense);
    });

    // Sort dates in descending order (most recent first)
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    
    return sortedDates.map(date => ({
      date,
      expenses: groups[date].sort((a, b) => b.id - a.id), // Sort expenses within date by ID descending
    }));
  }, [filteredExpenses]);

  const getDateLabel = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  const handleDelete = async (expenseId: number) => {
    const confirmed = await showConfirm('Are you sure you want to delete this expense?', {
      title: 'Delete Expense',
      confirmText: 'Delete',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });

    if (!confirmed) return;

    setDeletingId(expenseId);
    try {
      await onDelete(expenseId);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete expense:', err);
      showAlert('Failed to delete expense', { type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const getCategoryEmoji = (category?: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    return cat?.emoji || '📦';
  };

  const toggleExpanded = (expenseId: number) => {
    setExpandedExpense(expandedExpense === expenseId ? null : expenseId);
  };

  const hasActiveFilters = selectedCategory !== 'all' || selectedMember !== null;

  return (
    <div className="space-y-4">
      {/* Filter Button & Summary */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onFilterClick}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            hasActiveFilters
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm">Filters</span>
          {hasActiveFilters && (
            <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs font-semibold">
              •
            </span>
          )}
        </button>
        
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">{filteredExpenses.length}</span>
          {filteredExpenses.length !== expenses.length && (
            <span> of {expenses.length}</span>
          )}
          {filteredExpenses.length === 1 ? ' expense' : ' expenses'}
        </div>
      </div>

      {/* Expense List - Grouped by Date */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No expenses found</p>
          <p className="text-sm text-gray-400 mt-1">
            {hasActiveFilters
              ? 'Try adjusting your filters'
              : 'Add your first expense to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedExpenses.map(({ date, expenses: dateExpenses }) => (
            <div key={date} className="space-y-2">
              {/* Date Header */}
              <div className="sticky top-0 z-10 bg-gray-50 px-3 py-2 rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {getDateLabel(date)}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {dateExpenses.length} {dateExpenses.length === 1 ? 'expense' : 'expenses'}
                  </span>
                </div>
              </div>

              {/* Expenses for this date */}
              <div className="space-y-2">
                {dateExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Expense Header */}
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => toggleExpanded(expense.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{getCategoryEmoji(expense.category)}</span>
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                              {expense.description}
                            </h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Paid by {expense.paid_by_nickname}
                            </span>
                            {expense.category && (
                              <span className="flex items-center gap-1">
                                <Tag className="w-3 h-3" />
                                {expense.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-bold text-gray-900">
                              {Number(expense.amount).toFixed(2)} {expense.currency}
                            </div>
                            {expense.currency !== baseCurrency && (
                              <div className="text-xs text-gray-500">
                                ≈ {Number(expense.amount_in_base_currency).toFixed(2)} {baseCurrency}
                              </div>
                            )}
                          </div>
                          <ChevronDown
                            className={`w-5 h-5 text-gray-400 transition-transform ${
                              expandedExpense === expense.id ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedExpense === expense.id && (
                      <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-3">
                        {/* Notes */}
                        {expense.notes && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-700 mb-1">Notes</h4>
                            <p className="text-sm text-gray-600">{expense.notes}</p>
                          </div>
                        )}

                        {/* Splits */}
                        <div>
                          <h4 className="text-xs font-medium text-gray-700 mb-2">Split Details</h4>
                          <div className="space-y-1">
                            {expense.splits.map((split) => (
                              <div
                                key={split.id}
                                className="flex justify-between items-center text-sm py-1"
                              >
                                <span className="text-gray-700">{split.member_nickname}</span>
                                <span className="font-medium text-gray-900">
                                  {Number(split.amount).toFixed(2)} {baseCurrency}
                                  {split.percentage && (
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({Number(split.percentage).toFixed(1)}%)
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        {currentUserId && (expense.created_by === currentUserId || isCurrentUserAdmin) && (
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(expense.id);
                              }}
                              disabled={deletingId === expense.id}
                              className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              {deletingId === expense.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

