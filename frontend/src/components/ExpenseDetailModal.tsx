/**
 * Expense Detail Modal Component
 * Shows detailed information about an expense in a modal
 * Uses useExpense hook with initial data for instant display
 */
import { format, parseISO } from "date-fns";
import { Loader2, Pencil, Trash2, X } from "lucide-react";
import React, { useState } from "react";
import { useExpense } from "../hooks/useExpenses";
import type { Expense, TripMember, UpdateExpenseInput } from "../types";
import { EditExpenseModal } from "./EditExpenseModal";

interface ExpenseDetailModalProps {
  tripId: string;
  expenseId: number | null;
  /** Initial expense data from list for instant display */
  initialExpense?: Expense | null;
  baseCurrency: string;
  members: TripMember[];
  currentUserId?: string;
  currentUserMemberId?: number;
  isCurrentUserAdmin?: boolean;
  onClose: () => void;
  onDelete: (expenseId: number) => void;
  onUpdate: (expenseId: number, expenseData: UpdateExpenseInput) => Promise<void>;
  deletingId: number | null;
}

const CATEGORIES = [
  { value: "food", label: "Food & Drinks", emoji: "🍽️" },
  { value: "transport", label: "Transport", emoji: "🚗" },
  { value: "accommodation", label: "Accommodation", emoji: "🏨" },
  { value: "activities", label: "Activities", emoji: "🎭" },
  { value: "shopping", label: "Shopping", emoji: "🛍️" },
  { value: "other", label: "Other", emoji: "📦" },
];

export const ExpenseDetailModal: React.FC<ExpenseDetailModalProps> = ({
  tripId,
  expenseId,
  initialExpense,
  baseCurrency,
  members,
  currentUserId,
  currentUserMemberId,
  isCurrentUserAdmin,
  onClose,
  onDelete,
  onUpdate,
  deletingId,
}) => {
  const [showEditModal, setShowEditModal] = useState(false);

  // Use the useExpense hook with initial data for instant display
  const { data: expense, isLoading: isLoadingExpense } = useExpense(
    tripId,
    expenseId ?? undefined,
    initialExpense ?? undefined
  );

  if (!expenseId) return null;


  const handleOnClose = () => {
    if (deletingId !== null) return;

    onClose();
  };


  // Show loading state if no initial data and still fetching
  if (isLoadingExpense && !expense) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleOnClose}
        />
        <div className="flex min-h-full items-end justify-center sm:items-center">
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg p-8">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
              <span className="text-gray-600">Loading expense...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!expense) return null;

  const getCategoryEmoji = (category?: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    return cat?.emoji || "📦";
  };

  const isSettlement = expense.expense_type === "settlement";
  const isOptimistic = expense._isOptimistic === true;
  const canEdit = !!currentUserId && expense.created_by === currentUserId;
  const createdAtLabel = format(parseISO(expense.created_at), "PPP");
  const lastUpdatedLabel =
    expense.updated_at && expense.updated_at !== expense.created_at
      ? format(parseISO(expense.updated_at), "PPP p")
      : null;

  // Calculate what the user needs to pay or will get back
  const calculateUserBalance = () => {
    if (currentUserMemberId === null || isSettlement) return null;

    const userSplit = expense.splits.find(
      (s) => s.member_id === currentUserMemberId
    );
    if (!userSplit) return null;

    const isPaidByUser = expense.paid_by_member_id === currentUserMemberId;

    if (isPaidByUser) {
      // User paid: they will get back (total - their share)
      const amountToGetBack = expense.amount - userSplit.amount;
      if (amountToGetBack <= 0) return null; // Don't show if nothing to get back

      return {
        type: "get_back" as const,
        amount: amountToGetBack * expense.exchange_rate_to_base,
        amountInOriginal: amountToGetBack,
      };
    } else {
      // User didn't pay: they need to pay their share
      if (userSplit.amount <= 0) return null; // Don't show if nothing to pay

      return {
        type: "pay_back" as const,
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
        onClick={handleOnClose}
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
                    <svg
                      className="w-6 h-6 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
                    {getCategoryEmoji(expense.category)}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {isSettlement ? "Settlement" : expense.description}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {createdAtLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={handleOnClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Optimistic Update Indicator */}
            {isOptimistic && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-sm text-blue-700">Saving changes...</span>
              </div>
            )}

            {/* Amount Card */}
            <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-primary-700 font-medium">
                  Total Amount
                </span>
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
                {isSettlement ? "" : `Paid by ${expense.paid_by_nickname}`}
              </div>
            </div>

            {/* User Balance - What they need to pay or will get back */}
            {userBalance && !isOptimistic && (
              <div
                className={`rounded-xl p-4 ${userBalance.type === "get_back"
                  ? "bg-green-50 border-2 border-green-200"
                  : "bg-red-50 border-2 border-red-200"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3
                      className={`text-sm font-semibold mb-1 ${userBalance.type === "get_back"
                        ? "text-green-900"
                        : "text-red-900"
                        }`}
                    >
                      {userBalance.type === "get_back"
                        ? "You will get back"
                        : "You need to pay back"}
                    </h3>
                    <p
                      className={`text-xs ${userBalance.type === "get_back"
                        ? "text-green-700"
                        : "text-red-700"
                        }`}
                    >
                      {userBalance.type === "get_back"
                        ? `${expense.paid_by_nickname === "You"
                          ? "You"
                          : expense.paid_by_nickname
                        } paid for others`
                        : `Your share of the expense`}
                    </p>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-2xl font-bold ${userBalance.type === "get_back"
                        ? "text-green-900"
                        : "text-red-900"
                        }`}
                    >
                      {expense.currency}{" "}
                      {Number(userBalance.amountInOriginal).toFixed(2)}
                    </div>
                    {expense.currency !== baseCurrency && (
                      <div
                        className={`text-sm ${userBalance.type === "get_back"
                          ? "text-green-700"
                          : "text-red-700"
                          }`}
                      >
                        ≈ {baseCurrency} {Number(userBalance.amount).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Optimistic placeholder for user balance */}
            {isOptimistic && !isSettlement && (
              <div className="bg-gray-50 rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            )}

            {/* Currency Conversion Info */}
            {expense.currency !== baseCurrency && !isSettlement && (
              <div className="bg-blue-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Currency Conversion
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Original Amount:</span>
                    <span className="font-semibold text-gray-900">
                      {expense.currency} {Number(expense.amount).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      Converted to {baseCurrency}:
                    </span>
                    <span className="font-semibold text-gray-900">
                      {baseCurrency}{" "}
                      {Number(expense.amount_in_base_currency).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 pt-2 border-t border-blue-100">
                    Exchange Rate: 1 {expense.currency} ={" "}
                    {Number(expense.exchange_rate_to_base).toFixed(4)}{" "}
                    {baseCurrency}
                  </div>
                </div>
              </div>
            )}

            {/* Split Details - Show shimmer when optimistic */}
            {expense.splits.length > 1 && !isOptimistic && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Split Between
                </h3>
                <div className="space-y-2">
                  {expense.splits.map((split) => (
                    <div
                      key={split.id}
                      className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0"
                    >
                      <span className="text-sm font-medium text-gray-900">
                        {split.member_nickname}
                      </span>
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
            )}

            {/* Optimistic placeholder for splits */}
            {isOptimistic && !isSettlement && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  Split Between
                  <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                </h3>
                <div className="space-y-2 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between items-center py-2">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {expense.notes && (
              <div className="bg-amber-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Notes
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {expense.notes}
                </p>
              </div>
            )}
          </div>

          {lastUpdatedLabel && (
            <div className="px-5 py-4 text-xs text-gray-500">
              Last updated on {lastUpdatedLabel}
            </div>
          )}

          {/* Footer Actions */}
          {currentUserId &&
            (expense.created_by === currentUserId || isCurrentUserAdmin) && (
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-4 rounded-b-2xl">
                {canEdit && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    disabled={isOptimistic || deletingId === expense.id}
                    className="w-full mb-3 px-4 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit {isSettlement ? "Settlement" : "Expense"}
                  </button>
                )}
                <button
                  onClick={() => onDelete(expense.id)}
                  disabled={deletingId === expense.id || isOptimistic}
                  className="w-full px-4 py-3 bg-red-50 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {deletingId === expense.id ? "Deleting..." : "Delete Expense"}
                </button>
              </div>
            )}
        </div>
      </div>

      <EditExpenseModal
        isOpen={showEditModal}
        expense={expense}
        members={members}
        baseCurrency={baseCurrency}
        onClose={() => setShowEditModal(false)}
        onUpdate={onUpdate}
      />
    </div>
  );
};
