/**
 * ExpenseList Component
 * 
 * Displays a list of expenses grouped by date with timeline headers.
 */
import { format, isToday, isYesterday } from 'date-fns';
import { Filter, Loader2, Receipt } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAlert } from '../contexts/AlertContext';
import { useDeleteExpense, useUpdateExpense } from '../hooks/useExpenses';
import type { Expense, TripMember, UpdateExpenseInput } from '../types';
import { parseUTCDate } from '../utils/dateUtils';
import { ExpenseDetailModal } from './ExpenseDetailModal';
import { ExpenseListSkeleton } from './ExpenseListSkeleton';

interface ExpenseListProps {
  tripId: string;
  expenses: Expense[];
  isLoading: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  members: TripMember[];
  baseCurrency: string;
  currentUserId?: string;
  isCurrentUserAdmin?: boolean;
  selectedCategory: string;
  selectedMember: number | null;
  onFilterClick?: () => void;
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
  tripId,
  expenses,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  baseCurrency,
  currentUserId,
  isCurrentUserAdmin = false,
  selectedCategory,
  selectedMember,
  members,
  onFilterClick,
}) => {
  const { showAlert, showConfirm } = useAlert();
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const deleteExpenseMutation = useDeleteExpense(tripId);
  const updateExpenseMutation = useUpdateExpense(tripId);

  // Get current user's member ID
  const currentUserMember = members.find(m => m.user_id === currentUserId);
  const currentUserMemberId = currentUserMember?.id;

  // Intersection Observer for infinite scrolling
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.1,
      rootMargin: '100px',
    });

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [handleIntersection]);

  // Since filtering is now done on the backend via the API, we don't need to filter here
  // The expenses prop already contains the filtered results
  const filteredExpenses = expenses;

  // Group expenses by date
  const groupedExpenses = useMemo(() => {
    const groups: { [key: string]: Expense[] } = {};

    filteredExpenses.forEach((expense) => {
      // Safety check for optimistic expenses that may not have created_at
      if (!expense.created_at) {
        const todayKey = format(new Date(), 'yyyy-MM-dd');
        if (!groups[todayKey]) groups[todayKey] = [];
        groups[todayKey].push(expense);
        return;
      }

      const date = format(parseUTCDate(expense.created_at), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(expense);
    });

    // Sort dates in descending order (most recent first)
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return sortedDates.map(date => ({
      date,
      expenses: groups[date].sort((a, b) => Math.abs(b.id) - Math.abs(a.id)), // Sort expenses within date by ID descending
    }));
  }, [filteredExpenses]);

  // Show skeleton while loading and no expenses
  if (isLoading && expenses.length === 0) {
    return <ExpenseListSkeleton />;
  }

  const getDateLabel = (dateString: string) => {
    const date = parseUTCDate(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  const handleDelete = async (expenseId: number) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this expense? This cannot be undone and may affect balances if already settled.',
      {
        title: 'Delete Expense',
        confirmText: 'Delete',
        confirmButtonClass: 'bg-red-600 hover:bg-red-700',
      });

    if (!confirmed) return;

    setDeletingId(expenseId);
    try {
      await deleteExpenseMutation.mutateAsync(expenseId);
      handleCloseModal(); // Close modal after successful deletion
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

  const handleExpenseClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedExpense(null);
  };

  const handleUpdate = async (expenseId: number, expenseData: UpdateExpenseInput) => {
    await updateExpenseMutation.mutateAsync({ expenseId, data: expenseData });
  };

  const hasActiveFilters = selectedCategory !== 'all' || selectedMember !== null;

  return (
    <div className="relative">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-gray-50 px-5 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
          <button
            onClick={onFilterClick}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 font-medium hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <span className="relative">
              <Filter className="w-4 h-4" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </span>
            Filter
          </button>
        </div>
      </div>

      {/* Expense List Content */}
      <div className="px-5 pt-3 space-y-3">
        {/* Expense List - Grouped by Date */}
        {filteredExpenses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
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
                <div className="px-1">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {getDateLabel(date)}
                  </h3>
                </div>

                {/* Expenses for this date */}
                <div className="space-y-2">
                  {dateExpenses.map((expense) => {
                    const isOptimistic = expense._isOptimistic;

                    return (
                      <button
                        key={expense.id}
                        onClick={() => !isOptimistic && handleExpenseClick(expense)}
                        disabled={isOptimistic}
                        className={`w-full bg-white rounded-xl p-4 transition-all text-left relative ${isOptimistic
                          ? 'opacity-75 cursor-not-allowed animate-pulse'
                          : 'hover:shadow-sm'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Icon */}
                          {expense.expense_type === 'settlement' ? (
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${isOptimistic ? 'bg-blue-100' : 'bg-gray-100'
                              }`}>
                              {isOptimistic ? (
                                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                              ) : (
                                getCategoryEmoji(expense.category)
                              )}
                            </div>
                          )}

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-gray-900 truncate">
                              {expense.expense_type === 'settlement' ? 'Settlement' : expense.description}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {isOptimistic
                                ? 'Processing...'
                                : expense.expense_type === 'settlement'
                                  ? expense.description
                                  : `${expense.paid_by_nickname} paid`
                              }
                            </p>
                          </div>

                          {/* Amount */}
                          <div className="text-right flex-shrink-0">
                            <div className="text-base font-semibold text-gray-900">
                              {expense.currency} {Number(expense.amount).toFixed(2)}
                            </div>
                            <p className="text-xs text-gray-400">
                              {isOptimistic || !expense.created_at ? 'Saving...' : format(parseUTCDate(expense.created_at), 'MMM d')}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Infinite scroll trigger */}
        {hasNextPage && (
          <div ref={loadMoreRef} className="flex justify-center py-4">
            {isFetchingNextPage ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading more expenses...</span>
              </div>
            ) : (
              <button
                onClick={onLoadMore}
                className="px-4 py-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Load more expenses
              </button>
            )}
          </div>
        )}
      </div>

      {/* Expense Detail Modal */}
      {showDetailModal && (
        <ExpenseDetailModal
          tripId={tripId}
          expenseId={selectedExpense?.id ?? null}
          initialExpense={selectedExpense}
          baseCurrency={baseCurrency}
          members={members}
          currentUserId={currentUserId}
          currentUserMemberId={currentUserMemberId}
          isCurrentUserAdmin={isCurrentUserAdmin}
          onClose={handleCloseModal}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          deletingId={deletingId}
        />
      )}
    </div>
  );
};

