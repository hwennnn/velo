/**
 * Filter Modal Component
 * Modal for filtering expenses by category and member
 */
import { Filter, X } from 'lucide-react';
import React from 'react';
import type { TripMember } from '../types';

interface FilterModalProps {
  isOpen: boolean;
  selectedCategory: string;
  selectedMember: number | null;
  selectedExpenseType: string;
  members: TripMember[];
  onClose: () => void;
  onCategoryChange: (category: string) => void;
  onMemberChange: (memberId: number | null) => void;
  onExpenseTypeChange: (expenseType: string) => void;
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
  onCategoryChange,
  onMemberChange,
  onExpenseTypeChange,
}) => {
  if (!isOpen) return null;

  const hasActiveFilters = selectedCategory !== 'all' || selectedMember !== null || selectedExpenseType !== 'all';

  const handleClearFilters = () => {
    onCategoryChange('all');
    onMemberChange(null);
    onExpenseTypeChange('all');
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

        <div className="p-4 space-y-4">
          {/* Expense Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {EXPENSE_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => onExpenseTypeChange(type.value)}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    selectedExpenseType === type.value
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span className="mr-1.5">{type.emoji}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => onCategoryChange(cat.value)}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    selectedCategory === cat.value
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span className="mr-1.5">{cat.emoji}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Member Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Paid By</label>
            <div className="space-y-2">
              <button
                onClick={() => onMemberChange(null)}
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  selectedMember === null
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Members
              </button>
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => onMemberChange(member.id)}
                  className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    selectedMember === member.id
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {member.nickname}
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
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

