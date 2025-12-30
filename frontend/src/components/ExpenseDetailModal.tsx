/**
 * Expense Detail Modal Component
 * Shows detailed information about an expense in a modal
 * Uses useExpense hook with initial data for instant display
 */
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Trash2, X } from "lucide-react";
import React, { useState } from "react";
import { useExpense } from "../hooks/useExpenses";
import type { Expense, TripMember, UpdateExpenseInput } from "../types";
import { parseUTCDate } from "../utils/dateUtils";
import { Avatar } from "./Avatar";
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
  const [selectedReceiptIndex, setSelectedReceiptIndex] = useState<number | null>(null);

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
  const createdAtLabel = format(parseUTCDate(expense.created_at), "PPP");
  const lastUpdatedLabel =
    expense.updated_at && expense.updated_at !== expense.created_at
      ? format(parseUTCDate(expense.updated_at), "PPP p")
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

      {/* Full Screen Image Viewer */}
      {selectedReceiptIndex !== null && expense.receipt_urls && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
            <span className="text-white font-medium">
              {selectedReceiptIndex + 1} / {expense.receipt_urls.length}
            </span>
            <button
              onClick={() => setSelectedReceiptIndex(null)}
              className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Main Image */}
          <div className="w-full h-full flex items-center justify-center p-4">
            <img
              src={expense.receipt_urls[selectedReceiptIndex]}
              alt={`Receipt ${selectedReceiptIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Navigation Controls */}
          {expense.receipt_urls.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedReceiptIndex((prev) =>
                    prev === 0 ? expense.receipt_urls!.length - 1 : prev! - 1
                  );
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedReceiptIndex((prev) =>
                    prev === expense.receipt_urls!.length - 1 ? 0 : prev! + 1
                  );
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          {/* Thumbnails Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 overflow-x-auto bg-gradient-to-t from-black/50 to-transparent">
            <div className="flex gap-2 justify-center">
              {expense.receipt_urls.map((url, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedReceiptIndex(index);
                  }}
                  className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors flex-shrink-0 ${selectedReceiptIndex === index
                    ? "border-primary-500"
                    : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                >
                  <img
                    src={url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
            {expense.currency !== baseCurrency && (
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

            {/* Expense Breakdown: Who Paid & Shared With */}
            {!isSettlement && !isOptimistic && (
              <div className="space-y-4">
                {/* Who Paid */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Who Paid</span>
                    <span className="text-xs font-semibold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">
                      Total: {expense.currency} {Number(expense.amount).toFixed(2)}
                    </span>
                  </div>
                  <div className="p-4">
                    {(() => {
                      const payer = members.find(m => m.id === expense.paid_by_member_id);
                      if (!payer) return null;

                      const payerSplit = expense.splits.find(s => s.member_id === expense.paid_by_member_id);
                      const amountGetBack = payerSplit ? expense.amount - payerSplit.amount : expense.amount;

                      return (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar member={payer} />
                            <div>
                              <p className="font-semibold text-gray-900">
                                {expense.paid_by_member_id === currentUserMemberId ? 'You' : expense.paid_by_nickname}
                              </p>
                              <p className="text-xs text-gray-500">
                                {payerSplit
                                  ? `Paid for self: ${expense.currency} ${Number(payerSplit.amount).toFixed(2)}`
                                  : 'Paid fully for others'
                                }
                              </p>
                            </div>
                          </div>
                          {amountGetBack > 0.01 && (
                            <div className="text-right bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                              <span className="text-xs font-medium text-emerald-600 block uppercase tracking-wide">Gets back</span>
                              <p className="font-bold text-emerald-700">{expense.currency} {amountGetBack.toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Shared With */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Shared With</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {expense.splits
                      .filter(s => s.member_id !== expense.paid_by_member_id)
                      .map((split) => {
                        const member = members.find(m => m.id === split.member_id);
                        if (!member) return null;

                        return (
                          <div key={split.id} className="p-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <Avatar member={member} size="sm" />
                              <span className="text-sm font-medium text-gray-900">
                                {split.member_id === currentUserMemberId ? 'You' : split.member_nickname}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-xs text-gray-400">Owes</span>
                                <span className="text-sm font-bold text-gray-900">
                                  {expense.currency} {Number(split.amount).toFixed(2)}
                                </span>
                              </div>
                              {split.percentage && (
                                <span className="text-xs text-gray-400 block">
                                  ({Number(split.percentage).toFixed(1)}%)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    {expense.splits.filter(s => s.member_id !== expense.paid_by_member_id).length === 0 && (
                      <div className="p-4 text-center text-gray-500 text-sm italic">
                        No other members involved
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Settlement Details */}
            {isSettlement && !isOptimistic && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const payer = members.find(m => m.id === expense.paid_by_member_id);
                      return payer ? <Avatar member={payer} /> : null;
                    })()}
                    <span className="text-sm font-medium">paid</span>
                    {(() => {
                      // Receiver is usually the first split
                      const receiverSplit = expense.splits[0];
                      const receiver = members.find(m => m.id === receiverSplit?.member_id);
                      return receiver ? <Avatar member={receiver} /> : null;
                    })()}
                  </div>
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

            {/* Receipt Images */}
            {expense.receipt_urls && expense.receipt_urls.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Receipts ({expense.receipt_urls.length})
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {expense.receipt_urls.map((url, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedReceiptIndex(index)}
                      className="flex-shrink-0 relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:border-primary-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <img
                        src={url}
                        alt={`Receipt ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
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
        tripId={tripId}
      />
    </div>
  );
};
