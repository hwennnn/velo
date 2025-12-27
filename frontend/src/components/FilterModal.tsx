/**
 * Filter Modal Component
 * Modal for filtering expenses by category and member
 */
import { Filter, X } from 'lucide-react';
import React, { useState } from 'react';
import type { TripMember } from '../types';
import { Avatar } from './Avatar';

interface FilterModalProps {
  isOpen: boolean;
  selectedCategory: string;
  selectedMember: number | null;
  selectedExpenseType: string;
  members: TripMember[];
  onClose: () => void;
  onApply: (category: string, memberId: number | null, expenseType: string) => void;
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

const EXPENSE_TYPES = [
  { value: 'all', label: 'All Types', emoji: '📋' },
  { value: 'expenses', label: 'Expenses', emoji: '💰' },
  { value: 'settlements', label: 'Settlements', emoji: '🤝' },
];

export const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  selectedCategory,
  selectedMember,
  selectedExpenseType,
  members,
  onClose,
  onApply,
}) => {

  const [category, setCategory] = useState(selectedCategory);
  const [memberId, setMemberId] = useState(selectedMember);
  const [expenseType, setExpenseType] = useState(selectedExpenseType);

  if (!isOpen) return null;

  const hasActiveFilters =
    category !== 'all' || memberId !== null || expenseType !== 'all';

  const handleClearFilters = () => {
    setCategory('all');
    setMemberId(null);
    setExpenseType('all');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl animate-slideUp sm:animate-fadeIn">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">Filter Expenses</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Expense Type Filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Type</label>
              {expenseType !== 'all' && (
                <span className="text-xs text-primary-700 bg-primary-50 px-2 py-1 rounded-full">
                  {EXPENSE_TYPES.find((t) => t.value === expenseType)?.label}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {EXPENSE_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setExpenseType(type.value)}
                  className={`px-3 py-2 rounded-full text-sm font-medium border transition-all flex items-center justify-center gap-1.5 ${expenseType === type.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <span>{type.emoji}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Category</label>
              {category !== 'all' && (
                <span className="text-xs text-primary-700 bg-primary-50 px-2 py-1 rounded-full">
                  {CATEGORIES.find((c) => c.value === category)?.label}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-1.5 ${category === cat.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <span>{cat.emoji}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Member Filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Paid By</label>
              {memberId !== null && (
                <span className="text-xs text-primary-700 bg-primary-50 px-2 py-1 rounded-full">
                  {members.find((m) => m.id === memberId)?.nickname}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
              <button
                onClick={() => setMemberId(null)}
                className={`px-3 py-2 rounded-full text-sm font-medium border transition-all flex items-center gap-2 ${memberId === null
                  ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
              >
                All Members
              </button>
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setMemberId(member.id)}
                  className={`px-3 py-2 rounded-full text-sm font-medium border transition-all flex items-center gap-2 ${memberId === member.id
                    ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <Avatar
                    member={member}
                    size="sm"
                    className="bg-gray-100 text-gray-700"
                  />
                  <span className="truncate max-w-[120px]">{member.nickname}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-2">
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Clear Filters
            </button>
          )}
          <button
            onClick={() => onApply(category, memberId, expenseType)}
            className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

