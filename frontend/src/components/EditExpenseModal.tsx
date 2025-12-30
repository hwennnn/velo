/**
 * EditExpenseModal Component
 *
 * Modal for editing an existing expense.
 * Supports updating amount, payer, currency, date, notes, and split logic.
 */
import { Check, ChevronDown, DollarSign, FileText, ImagePlus, Receipt, Trash2, Users, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getCurrencyInfo } from "../config/currencies";
import { useCurrencySettings } from "../hooks/useCurrencySettings";
import { storage } from "../services/supabase";
import type {
  Expense,
  SplitInput,
  TripMember,
  UpdateExpenseInput,
} from "../types";
import { getMemberInitials } from "../utils/memberUtils";
import { Avatar } from "./Avatar";

interface EditExpenseModalProps {
  isOpen: boolean;
  expense: Expense | null;
  onClose: () => void;
  onUpdate: (
    expenseId: number,
    expenseData: UpdateExpenseInput
  ) => Promise<void>;
  members: TripMember[];
  baseCurrency: string;
  tripId: string;
}

const CATEGORIES = [
  { value: "food", label: "Food & Drinks", emoji: "🍽️" },
  { value: "transport", label: "Transport", emoji: "🚗" },
  { value: "accommodation", label: "Accommodation", emoji: "🏨" },
  { value: "activities", label: "Activities", emoji: "🎭" },
  { value: "shopping", label: "Shopping", emoji: "🛍️" },
  { value: "other", label: "Other", emoji: "📦" },
];

function inferSplitType(expense: Expense): "equal" | "percentage" | "custom" {
  const splits = expense.splits || [];
  if (splits.length === 0) return "equal";

  const hasPercentages = splits.every((s) => typeof s.percentage === "number");
  if (hasPercentages) {
    const totalPct = splits.reduce((sum, s) => sum + (s.percentage || 0), 0);
    const allEqualPct = splits.every(
      (s) => Math.abs((s.percentage || 0) - (splits[0].percentage || 0)) < 0.02
    );

    if (Math.abs(totalPct - 100) < 0.05 && !allEqualPct) return "percentage";

    // If all equal percentages and amounts are equal-ish, treat as equal
    const amounts = splits.map((s) => Number(s.amount));
    const allEqualAmt = amounts.every((a) => Math.abs(a - amounts[0]) < 0.02);
    if (allEqualPct && allEqualAmt) return "equal";
  }

  return "custom";
}

export const EditExpenseModal: React.FC<EditExpenseModalProps> = ({
  isOpen,
  expense,
  onClose,
  onUpdate,
  members,
  baseCurrency,
  tripId,
}) => {
  const { getPreferredCurrencies } = useCurrencySettings();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [paidBy, setPaidBy] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [splitType, setSplitType] = useState<"equal" | "percentage" | "custom">(
    "equal"
  );
  const [selectedMembers, setSelectedMembers] = useState<Set<number>>(
    new Set()
  );
  const [customSplits, setCustomSplits] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Receipt state
  const [existingReceipts, setExistingReceipts] = useState<string[]>([]);
  const [newReceiptFiles, setNewReceiptFiles] = useState<File[]>([]);
  const [newReceiptPreviews, setNewReceiptPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSettlement = expense?.expense_type === "settlement";

  // Initialize form from expense
  useEffect(() => {
    if (!isOpen || !expense) return;

    setDescription(expense.description || "");
    setAmount(String(expense.amount ?? ""));
    setCurrency(expense.currency || baseCurrency);
    setPaidBy(expense.paid_by_member_id ?? null);
    setCategory(expense.category || "");
    setNotes(expense.notes || "");

    const inferred = inferSplitType(expense);
    setSplitType(inferred);

    const memberIds = new Set<number>(
      (expense.splits || []).map((s) => s.member_id)
    );
    // If no splits present (shouldn’t happen), default to all
    setSelectedMembers(
      memberIds.size > 0 ? memberIds : new Set(members.map((m) => m.id))
    );

    const splitMap: Record<number, string> = {};
    for (const s of expense.splits || []) {
      if (inferred === "percentage") {
        splitMap[s.member_id] = (s.percentage ?? 0).toFixed(2);
      } else if (inferred === "custom") {
        splitMap[s.member_id] = Number(s.amount).toFixed(2);
      }
    }
    setCustomSplits(splitMap);

    // Initialize receipts
    setExistingReceipts(expense.receipt_urls || []);
    setNewReceiptFiles([]);
    setNewReceiptPreviews([]);

    setError(null);
  }, [isOpen, expense, baseCurrency, members]);

  // Generate previews for new files
  useEffect(() => {
    const urls = newReceiptFiles.map(file => URL.createObjectURL(file));
    setNewReceiptPreviews(urls);

    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [newReceiptFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files).filter(file =>
        file.type.startsWith('image/')
      );
      setNewReceiptFiles(prev => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeExistingReceipt = (index: number) => {
    setExistingReceipts(prev => prev.filter((_, i) => i !== index));
  };

  const removeNewReceipt = (index: number) => {
    setNewReceiptFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Re-init default splits when type/members/amount changes (similar to create)
  useEffect(() => {
    if (!isOpen) return;
    const selectedMembersList = Array.from(selectedMembers);
    const selectedCount = selectedMembersList.length;

    if (selectedCount === 0) {
      setCustomSplits({});
      return;
    }

    if (splitType === "equal") {
      setCustomSplits({});
    } else if (splitType === "percentage") {
      const perMember = 100 / selectedCount;
      const splits: Record<number, string> = {};
      selectedMembersList.forEach((memberId) => {
        splits[memberId] = perMember.toFixed(2);
      });
      setCustomSplits(splits);
    } else if (splitType === "custom" && amount) {
      const amountNum = parseFloat(amount);
      if (!Number.isNaN(amountNum) && amountNum > 0) {
        const perMember = amountNum / selectedCount;
        const splits: Record<number, string> = {};
        selectedMembersList.forEach((memberId) => {
          splits[memberId] = perMember.toFixed(2);
        });
        setCustomSplits(splits);
      }
    }
  }, [isOpen, splitType, selectedMembers, amount]);

  const selectedMembersList = useMemo(
    () => Array.from(selectedMembers),
    [selectedMembers]
  );

  const displayedCurrencies = useMemo(() => {
    const preferred = getPreferredCurrencies();
    const currentCode = expense?.currency || baseCurrency;

    // Check if current currency is already in preferred list
    const hasCurrent = preferred.some((c) => c.code === currentCode);

    if (hasCurrent) {
      return preferred;
    }

    // Add current currency if missing
    return [...preferred, getCurrencyInfo(currentCode)];
  }, [getPreferredCurrencies, expense, baseCurrency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expense) return;

    setError(null);

    if (!description.trim()) {
      setError("Description is required");
      return;
    }

    const amountNum = parseFloat(amount);
    if (!amount || Number.isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!paidBy) {
      setError("Please select who paid");
      return;
    }

    if (!isSettlement && selectedMembers.size === 0) {
      setError("Please select at least one member for the split");
      return;
    }

    // Build splits payload
    let splits: SplitInput[] | undefined;

    if (!isSettlement) {
      if (splitType === "equal") {
        // backend equal: if splits provided, uses those member_ids
        splits = selectedMembersList.map((memberId) => ({
          member_id: memberId,
        }));
      } else if (splitType === "percentage") {
        const totalPct = selectedMembersList.reduce(
          (sum, memberId) =>
            sum + (parseFloat(customSplits[memberId] || "0") || 0),
          0
        );
        if (Math.abs(totalPct - 100) > 0.05) {
          setError("Percentages must sum to 100");
          return;
        }
        splits = selectedMembersList.map((memberId) => ({
          member_id: memberId,
          percentage: parseFloat(customSplits[memberId] || "0") || 0,
        }));
      } else {
        const totalAmt = selectedMembersList.reduce(
          (sum, memberId) =>
            sum + (parseFloat(customSplits[memberId] || "0") || 0),
          0
        );
        if (Math.abs(totalAmt - amountNum) > 0.05) {
          setError("Custom split amounts must sum to total amount");
          return;
        }
        splits = selectedMembersList.map((memberId) => ({
          member_id: memberId,
          amount: parseFloat(customSplits[memberId] || "0") || 0,
        }));
      }
    }

    const payload: UpdateExpenseInput = {
      description: description.trim(),
      amount: amountNum,
      currency,
      paid_by_member_id: paidBy,
      category: category || undefined,
      notes: notes || undefined,
      ...(isSettlement
        ? {}
        : {
          split_type: splitType,
          splits,
        }),
    };

    setIsLoading(true);
    try {
      // Upload new receipt images if any
      let finalReceiptUrls = [...existingReceipts];

      if (newReceiptFiles.length > 0) {
        setIsUploading(true);
        const { urls, errors: uploadErrors } = await storage.uploadReceipts(newReceiptFiles, tripId);
        setIsUploading(false);

        if (uploadErrors.length > 0) {
          console.error('Some receipts failed to upload:', uploadErrors);
        }

        finalReceiptUrls = [...finalReceiptUrls, ...urls];
      }

      // Add receipt_urls to payload
      const finalPayload: UpdateExpenseInput = {
        ...payload,
        receipt_urls: finalReceiptUrls.length > 0 ? finalReceiptUrls : undefined,
      };

      await onUpdate(expense.id, finalPayload);
      onClose();
    } catch {
      setIsUploading(false);
      setError("Failed to update expense");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMember = (memberId: number) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  if (!isOpen || !expense) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Edit {isSettlement ? "Settlement" : "Expense"}
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Changes will update balances automatically.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Description *
            </label>
            <div className="relative">
              <FileText className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Amount *
              </label>
              <div className="relative">
                <DollarSign className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Currency
              </label>
              <div className="relative">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                  disabled={isLoading}
                >
                  {displayedCurrencies.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.code} ({curr.symbol})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Paid By */}
          {!isSettlement && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Who Paid? *
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setPaidBy(member.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${paidBy === member.id
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:bg-gray-50"
                      }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-700">
                      <Avatar
                        member={member}
                        size="sm"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {member.nickname}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isSettlement && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Who Paid? *
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                <button
                  disabled={true}
                  key={expense.paid_by_member_id}
                  type="button"
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left border-primary-500 bg-primary-50`}
                >
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-700">
                    {getMemberInitials(expense.paid_by_nickname)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {expense.paid_by_nickname}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}


          {/* Category */}
          {
            !isSettlement && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Category
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                    disabled={isLoading}
                  >
                    <option value="">No category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.emoji} {c.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )
          }

          {/* Notes */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* Receipt Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              <Receipt className="w-4 h-4 inline mr-1" />
              Receipts
            </label>

            {/* Existing Receipts */}
            {existingReceipts.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {existingReceipts.map((url, index) => (
                  <div key={`existing-${index}`} className="relative group">
                    <img
                      src={url}
                      alt={`Receipt ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingReceipt(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* New Receipt Previews */}
            {newReceiptPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {newReceiptPreviews.map((url, index) => (
                  <div key={`new-${index}`} className="relative group">
                    <img
                      src={url}
                      alt={`New Receipt ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border-2 border-dashed border-primary-300"
                    />
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-primary-500 text-white text-xs rounded">New</div>
                    <button
                      type="button"
                      onClick={() => removeNewReceipt(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors flex items-center justify-center gap-2"
            >
              <ImagePlus className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">Add receipt images</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {isUploading && (
              <div className="text-sm text-primary-600 text-center animate-pulse">
                Uploading receipts...
              </div>
            )}
          </div>

          {/* Split controls (skip for settlement for now) */}
          {!isSettlement && (
            <>
              <div className="border-t border-gray-200 pt-4" />

              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Users className="w-4 h-4" />
                Split
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(["equal", "percentage", "custom"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSplitType(t)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${splitType === t
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700"
                      }`}
                    disabled={isLoading}
                  >
                    {t === "equal"
                      ? "Equal"
                      : t === "percentage"
                        ? "%"
                        : "Custom"}
                  </button>
                ))}
              </div>

              {/* Member selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Who is included?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {members.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleMember(member.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border text-left ${selectedMembers.has(member.id)
                        ? "border-primary-500 bg-primary-50"
                        : "border-gray-200 hover:bg-gray-50"
                        }`}
                      disabled={isLoading}
                    >
                      <span className="text-sm font-medium text-gray-900">
                        {member.nickname}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${selectedMembers.has(member.id)
                          ? "bg-primary-100 text-primary-700"
                          : "bg-gray-100 text-gray-600"
                          }`}
                      >
                        {selectedMembers.has(member.id)
                          ? "Included"
                          : "Excluded"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Split inputs */}
              {(splitType === "percentage" || splitType === "custom") && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {splitType === "percentage" ? "Percentages" : "Amounts"}
                  </label>
                  <div className="space-y-2">
                    {selectedMembersList.map((memberId) => {
                      const member = members.find((m) => m.id === memberId);
                      if (!member) return null;
                      return (
                        <div key={memberId} className="flex items-center gap-3">
                          <div className="flex-1 text-sm font-medium text-gray-900">
                            {member.nickname}
                          </div>
                          <input
                            type="number"
                            step={splitType === "percentage" ? "0.01" : "0.01"}
                            value={customSplits[memberId] || ""}
                            onChange={(e) =>
                              setCustomSplits((prev) => ({
                                ...prev,
                                [memberId]: e.target.value,
                              }))
                            }
                            className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            disabled={isLoading}
                          />
                          <div className="w-10 text-sm text-gray-500">
                            {splitType === "percentage" ? "%" : currency}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="pt-2" />

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
