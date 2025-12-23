/**
 * AddMemberModal Component
 * 
 * Modal for adding members to a trip.
 * Supports adding real users by email or creating fictional members.
 */
import React, { useState } from 'react';
import { X, User, UserPlus, Mail, Shield } from 'lucide-react';
import type { AddMemberInput, TripMember } from '../types';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (memberData: AddMemberInput) => Promise<void>;
  existingMembers: TripMember[];
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  existingMembers,
}) => {
  const [nickname, setNickname] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isFictional, setIsFictional] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    if (!nickname.trim()) {
      setError('Nickname is required');
      return;
    }

    if (!isFictional && !userEmail.trim()) {
      setError('Email is required for real members');
      return;
    }

    // Check if email already exists
    if (!isFictional && userEmail.trim()) {
      const emailExists = existingMembers.some(
        (m) => m.email?.toLowerCase() === userEmail.trim().toLowerCase()
      );
      if (emailExists) {
        setError('A member with this email already exists');
        return;
      }
    }

    setIsLoading(true);

    try {
      await onAdd({
        nickname: nickname.trim(),
        is_fictional: isFictional,
        user_email: isFictional ? undefined : userEmail.trim(),
        is_admin: isAdmin,
      });

      // Reset form
      setNickname('');
      setUserEmail('');
      setIsFictional(false);
      setIsAdmin(false);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add member');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setNickname('');
      setUserEmail('');
      setIsFictional(false);
      setIsAdmin(false);
      setError(null);
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
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl animate-slideUp sm:animate-fadeIn max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-primary-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Add Member</h2>
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

          {/* Member Type Toggle */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Member Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsFictional(false)}
                className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                  !isFictional
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <User className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Real User</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFictional(true)}
                className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                  isFictional
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <User className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Fictional</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {isFictional
                ? 'Create a placeholder member that can be claimed later'
                : 'Add an existing user by their email address'}
            </p>
          </div>

          {/* Email (for real users) */}
          {!isFictional && (
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={isLoading}
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {/* Nickname */}
          <div className="space-y-2">
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
              Display Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g., John, Sarah, Alex"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={isLoading}
                autoFocus
                maxLength={100}
              />
            </div>
            <p className="text-xs text-gray-500">
              The name that will be displayed for this member in the trip
            </p>
          </div>

          {/* Admin Toggle */}
          <div className="space-y-2">
            <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-900">
                    Grant Admin Access
                  </span>
                  <span className="block text-xs text-gray-500">
                    Can manage trip, members, and expenses
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                disabled={isLoading}
                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
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
              {isLoading ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

