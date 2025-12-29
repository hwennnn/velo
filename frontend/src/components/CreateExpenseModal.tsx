/**
 * CreateExpenseModal Component
 * 
 * Modal for creating new expenses with split management.
 * Supports equal, percentage, and custom splits.
 */
import axios from 'axios';
import { Check, ChevronDown, DollarSign, FileText, Receipt, Users, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { SUPPORTED_CURRENCIES } from '../config/currencies';
import type { CreateExpenseInput, SplitInput, TripMember } from '../types';
import { Avatar } from './Avatar';

interface CreateExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (expenseData: CreateExpenseInput) => Promise<void>;
  members: TripMember[];
  baseCurrency: string;
}


const CATEGORIES = [
  { value: 'food', label: 'Food & Drinks', emoji: '🍽️' },
  { value: 'transport', label: 'Transport', emoji: '🚗' },
  { value: 'accommodation', label: 'Accommodation', emoji: '🏨' },
  { value: 'activities', label: 'Activities', emoji: '🎭' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { value: 'other', label: 'Other', emoji: '📦' },
];

export const CreateExpenseModal: React.FC<CreateExpenseModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  members,
  baseCurrency,
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [paidBy, setPaidBy] = useState<number | null>(null);
  const [category, setCategory] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'percentage' | 'custom'>('equal');
  const [selectedMembers, setSelectedMembers] = useState<Set<number>>(new Set());
  const [customSplits, setCustomSplits] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setAmount('');
      setCurrency(baseCurrency);
      setPaidBy(members.length > 0 ? members[0].id : null);
      setCategory('');
      setNotes('');
      setSplitType('equal');
      // Select all members by default
      setSelectedMembers(new Set(members.map(m => m.id)));
      setCustomSplits({});
      setError(null);
    }
  }, [isOpen, baseCurrency, members]);

  // Initialize custom splits when split type or selected members change
  useEffect(() => {
    const selectedMembersList = Array.from(selectedMembers);
    const selectedCount = selectedMembersList.length;

    if (selectedCount === 0) {
      setCustomSplits({});
      return;
    }

    if (splitType === 'equal') {
      setCustomSplits({});
    } else if (splitType === 'percentage') {
      const perMember = 100 / selectedCount;
      const splits: Record<number, string> = {};
      selectedMembersList.forEach((memberId) => {
        splits[memberId] = perMember.toFixed(2);
      });
      setCustomSplits(splits);
    } else if (splitType === 'custom' && amount) {
      const perMember = parseFloat(amount) / selectedCount;
      const splits: Record<number, string> = {};
      selectedMembersList.forEach((memberId) => {
        splits[memberId] = perMember.toFixed(2);
      });
      setCustomSplits(splits);
    }
  }, [splitType, selectedMembers, amount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (paidBy === null) {
      setError('Please select who paid');
      return;
    }

    // Validate at least one member is selected
    if (selectedMembers.size === 0) {
      setError('Please select at least one member to split with');
      return;
    }

    // Validate splits
    let splits: SplitInput[] | undefined;

    if (splitType === 'equal') {
      // For equal splits, only include selected members
      splits = Array.from(selectedMembers).map(memberId => ({
        member_id: memberId,
      }));
    } else if (splitType === 'percentage') {
      splits = Array.from(selectedMembers).map((memberId) => ({
        member_id: memberId,
        percentage: parseFloat(customSplits[memberId] || '0'),
      }));

      const totalPercentage = splits.reduce((sum, s) => sum + (s.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        setError(`Percentages must add up to 100% (currently ${totalPercentage.toFixed(2)}%)`);
        return;
      }
    } else if (splitType === 'custom') {
      splits = Array.from(selectedMembers).map((memberId) => ({
        member_id: memberId,
        amount: parseFloat(customSplits[memberId] || '0'),
      }));

      const totalAmount = splits.reduce((sum, s) => sum + (s.amount || 0), 0);
      if (Math.abs(totalAmount - amountNum) > 0.01) {
        setError(
          `Split amounts must add up to ${amountNum.toFixed(2)} ${currency} (currently ${totalAmount.toFixed(2)})`
        );
        return;
      }
    }

    setIsLoading(true);

    try {
      await onCreate({
        description: description.trim(),
        amount: amountNum,
        currency,
        paid_by_member_id: paidBy,
        category: category || undefined,
        notes: notes.trim() || undefined,
        split_type: splitType,
        splits,
      });

      onClose();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Failed to create expense');
      } else {
        setError('Failed to create expense');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl animate-slideUp sm:animate-fadeIn max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-primary-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Add Expense</h2>
            </div>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description *
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Dinner at restaurant"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={isLoading}
                autoFocus
                maxLength={200}
              />
            </div>
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                Amount *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                Currency
              </label>
              <div className="relative">
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                  disabled={isLoading}
                >
                  {SUPPORTED_CURRENCIES.map((curr) => (
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
                  className={`p-3 rounded-lg border-2 transition-all ${paidBy === member.id
                    ? 'border-primary-500 bg-primary-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  disabled={isLoading}
                >
                  <div className="flex items-center gap-2">
                    <Avatar
                      key={member.id}
                      member={member}
                      size="sm"
                      className="border-2 border-white"
                    />
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {member.nickname}
                      </div>
                      {member.status === 'placeholder' && (
                        <div className="text-xs text-amber-600">Placeholder</div>
                      )}
                      {member.status === 'pending' && (
                        <div className="text-xs text-blue-600">Pending</div>
                      )}
                    </div>
                    {paidBy === member.id && (
                      <Check className="w-5 h-5 text-primary-600 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <div className="relative">
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                disabled={isLoading}
              >
                <option value="">Select category...</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.emoji} {cat.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Split With */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                <Users className="w-4 h-4 inline mr-1" />
                Split With *
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMembers(new Set(members.map(m => m.id)))}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  disabled={isLoading}
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedMembers(new Set())}
                  className="text-xs text-gray-600 hover:text-gray-700 font-medium"
                  disabled={isLoading}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {members.map((member) => {
                const isSelected = selectedMembers.has(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      const newSelected = new Set(selectedMembers);
                      if (isSelected) {
                        newSelected.delete(member.id);
                      } else {
                        newSelected.add(member.id);
                      }
                      setSelectedMembers(newSelected);
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${isSelected
                      ? 'border-primary-500 bg-primary-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    disabled={isLoading}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 ${!isSelected && 'opacity-40'
                          }`}
                      >
                        <Avatar
                          key={`split-with-${member.id}`}
                          member={member}
                          size="sm"
                          className="border-2 border-white"
                        />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className={`text-sm font-medium truncate ${isSelected ? 'text-gray-900' : 'text-gray-500'
                          }`}>
                          {member.nickname}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-primary-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedMembers.size > 0 && (
              <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 text-center">
                {selectedMembers.size} {selectedMembers.size === 1 ? 'person' : 'people'} selected
              </div>
            )}
          </div>

          {/* Split Type */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Split Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSplitType('equal')}
                className={`px-4 py-3 rounded-lg border-2 transition-colors ${splitType === 'equal'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                disabled={isLoading}
              >
                <div className="text-sm font-medium">Equal</div>
                <div className="text-xs opacity-70 mt-0.5">Split evenly</div>
              </button>
              <button
                type="button"
                onClick={() => setSplitType('percentage')}
                className={`px-4 py-3 rounded-lg border-2 transition-colors ${splitType === 'percentage'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                disabled={isLoading}
              >
                <div className="text-sm font-medium">Percentage</div>
                <div className="text-xs opacity-70 mt-0.5">By %</div>
              </button>
              <button
                type="button"
                onClick={() => setSplitType('custom')}
                className={`px-4 py-3 rounded-lg border-2 transition-colors ${splitType === 'custom'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                disabled={isLoading}
              >
                <div className="text-sm font-medium">Custom</div>
                <div className="text-xs opacity-70 mt-0.5">Exact amounts</div>
              </button>
            </div>
          </div>

          {/* Custom Splits */}
          {splitType !== 'equal' && selectedMembers.size > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {splitType === 'percentage' ? 'Percentage per Member' : 'Amount per Member'}
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                {Array.from(selectedMembers).map((memberId) => {
                  const member = members.find(m => m.id === memberId);
                  if (!member) return null;

                  return (
                    <div key={member.id} className="flex items-center gap-2 bg-white rounded-lg p-2">
                      <span className="flex-1 text-sm font-medium text-gray-700">{member.nickname}</span>
                      <input
                        type="number"
                        value={customSplits[member.id] || '0'}
                        onChange={(e) =>
                          setCustomSplits({ ...customSplits, [member.id]: e.target.value })
                        }
                        step="0.01"
                        min="0"
                        className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                        disabled={isLoading}
                      />
                      <span className="text-sm text-gray-500 w-10 text-right">
                        {splitType === 'percentage' ? '%' : currency}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Split Summary */}
              {splitType === 'percentage' && (
                <div className="text-xs text-center">
                  <span className="text-gray-600">Total: </span>
                  <span className={`font-semibold ${Math.abs(Array.from(selectedMembers).reduce((sum, id) =>
                    sum + parseFloat(customSplits[id] || '0'), 0) - 100) < 0.01
                    ? 'text-green-600'
                    : 'text-red-600'
                    }`}>
                    {Array.from(selectedMembers).reduce((sum, id) =>
                      sum + parseFloat(customSplits[id] || '0'), 0).toFixed(2)}%
                  </span>
                  <span className="text-gray-600"> / 100%</span>
                </div>
              )}

              {splitType === 'custom' && amount && (
                <div className="text-xs text-center">
                  <span className="text-gray-600">Total: </span>
                  <span className={`font-semibold ${Math.abs(Array.from(selectedMembers).reduce((sum, id) =>
                    sum + parseFloat(customSplits[id] || '0'), 0) - parseFloat(amount)) < 0.01
                    ? 'text-green-600'
                    : 'text-red-600'
                    }`}>
                    {Array.from(selectedMembers).reduce((sum, id) =>
                      sum + parseFloat(customSplits[id] || '0'), 0).toFixed(2)} {currency}
                  </span>
                  <span className="text-gray-600"> / {parseFloat(amount).toFixed(2)} {currency}</span>
                </div>
              )}
            </div>
          )
          }

          {/* Notes */}
          <div className="space-y-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional details..."
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              disabled={isLoading}
              maxLength={500}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form >
      </div >
    </div >
  );
};

