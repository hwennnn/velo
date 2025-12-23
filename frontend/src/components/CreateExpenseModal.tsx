/**
 * CreateExpenseModal Component
 * 
 * Modal for creating new expenses with split management.
 * Supports equal, percentage, and custom splits.
 */
import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Tag, FileText, Receipt, Users } from 'lucide-react';
import type { CreateExpenseInput, TripMember, SplitInput } from '../types';

interface CreateExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (expenseData: CreateExpenseInput) => Promise<void>;
  members: TripMember[];
  baseCurrency: string;
}

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
];

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
  const [expenseDate, setExpenseDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [category, setCategory] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'percentage' | 'custom'>('equal');
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
      const today = new Date();
      setExpenseDate(today.toISOString().split('T')[0]);
      setCategory('');
      setNotes('');
      setSplitType('equal');
      setCustomSplits({});
      setError(null);
    }
  }, [isOpen, baseCurrency, members]);

  // Initialize custom splits when split type changes
  useEffect(() => {
    if (splitType === 'equal') {
      setCustomSplits({});
    } else if (splitType === 'percentage') {
      const perMember = 100 / members.length;
      const splits: Record<number, string> = {};
      members.forEach((member) => {
        splits[member.id] = perMember.toFixed(2);
      });
      setCustomSplits(splits);
    } else if (splitType === 'custom' && amount) {
      const perMember = parseFloat(amount) / members.length;
      const splits: Record<number, string> = {};
      members.forEach((member) => {
        splits[member.id] = perMember.toFixed(2);
      });
      setCustomSplits(splits);
    }
  }, [splitType, members, amount]);

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

    if (!expenseDate) {
      setError('Please select a date');
      return;
    }

    // Validate splits
    let splits: SplitInput[] | undefined;

    if (splitType === 'percentage') {
      splits = Object.entries(customSplits).map(([memberId, percentage]) => ({
        member_id: parseInt(memberId),
        percentage: parseFloat(percentage),
      }));

      const totalPercentage = splits.reduce((sum, s) => sum + (s.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        setError(`Percentages must add up to 100% (currently ${totalPercentage.toFixed(2)}%)`);
        return;
      }
    } else if (splitType === 'custom') {
      splits = Object.entries(customSplits).map(([memberId, amt]) => ({
        member_id: parseInt(memberId),
        amount: parseFloat(amt),
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
        expense_date: expenseDate,
        category: category || undefined,
        notes: notes.trim() || undefined,
        split_type: splitType,
        splits,
      });

      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create expense');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
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
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={isLoading}
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code} ({curr.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Paid By */}
          <div className="space-y-2">
            <label htmlFor="paidBy" className="block text-sm font-medium text-gray-700">
              Paid By *
            </label>
            <select
              id="paidBy"
              value={paidBy || ''}
              onChange={(e) => setPaidBy(parseInt(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isLoading}
            >
              <option value="">Select member...</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nickname} {member.is_fictional && '(Fictional)'}
                </option>
              ))}
            </select>
          </div>

          {/* Date and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  id="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={isLoading}
              >
                <option value="">Select category...</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.emoji} {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Split Type */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              <Users className="w-4 h-4 inline mr-1" />
              Split Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSplitType('equal')}
                className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                  splitType === 'equal'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="block text-sm font-medium">Equal</span>
              </button>
              <button
                type="button"
                onClick={() => setSplitType('percentage')}
                className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                  splitType === 'percentage'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="block text-sm font-medium">Percentage</span>
              </button>
              <button
                type="button"
                onClick={() => setSplitType('custom')}
                className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                  splitType === 'custom'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="block text-sm font-medium">Custom</span>
              </button>
            </div>
          </div>

          {/* Custom Splits */}
          {splitType !== 'equal' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {splitType === 'percentage' ? 'Percentage per Member' : 'Amount per Member'}
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-gray-700">{member.nickname}</span>
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
                    <span className="text-sm text-gray-500 w-8">
                      {splitType === 'percentage' ? '%' : currency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
        </form>
      </div>
    </div>
  );
};

