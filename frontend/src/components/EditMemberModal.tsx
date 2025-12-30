/**
 * EditMemberModal Component
 * 
 * Modal for editing member details (nickname, email).
 * Email can only be changed for pending/placeholder members.
 * State transitions:
 * - placeholder + add email → pending
 * - pending + remove email → placeholder
 * - active → email cannot be changed
 */
import axios from 'axios';
import { Mail, Shield, User, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { TripMember } from '../types';
import { Avatar } from './Avatar';

interface EditMemberModalProps {
    isOpen: boolean;
    member: TripMember | null;
    existingMembers: TripMember[];
    onClose: () => void;
    onSave: (memberId: number, data: { nickname?: string; email?: string; is_admin?: boolean }) => Promise<void>;
}

export const EditMemberModal: React.FC<EditMemberModalProps> = ({
    isOpen,
    member,
    existingMembers,
    onClose,
    onSave,
}) => {
    const [nickname, setNickname] = useState('');
    const [email, setEmail] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset form when member changes
    useEffect(() => {
        if (member) {
            setNickname(member.nickname);
            setEmail(member.invited_email || '');
            setIsAdmin(member.is_admin);
            setError(null);
        }
    }, [member]);

    const canEditEmail = member?.status !== 'active';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!member) return;
        setError(null);

        // Validate nickname
        if (!nickname.trim()) {
            setError('Display name is required');
            return;
        }

        // Check for duplicate email (if email provided and changed)
        const trimmedEmail = email.trim().toLowerCase();
        if (trimmedEmail && trimmedEmail !== member.invited_email?.toLowerCase()) {
            const emailExists = existingMembers.some(
                (m) => m.id !== member.id && (
                    m.email?.toLowerCase() === trimmedEmail ||
                    m.invited_email?.toLowerCase() === trimmedEmail
                )
            );
            if (emailExists) {
                setError('A member with this email already exists in this trip');
                return;
            }
        }

        setIsLoading(true);

        try {
            const updateData: { nickname?: string; email?: string; is_admin?: boolean } = {};

            // Only include nickname if changed
            if (nickname.trim() !== member.nickname) {
                updateData.nickname = nickname.trim();
            }

            // Only include email if changed (for non-active members)
            if (canEditEmail) {
                const newEmail = email.trim() || '';
                const oldEmail = member.invited_email || '';
                if (newEmail !== oldEmail) {
                    updateData.email = newEmail;
                }
            }

            // Include is_admin if changed
            if (isAdmin !== member.is_admin) {
                updateData.is_admin = isAdmin;
            }

            // Only call API if there are changes
            if (Object.keys(updateData).length > 0) {
                await onSave(member.id, updateData);
            }

            onClose();
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.detail || 'Failed to update member');
            } else {
                setError('Failed to update member');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            onClose();
        }
    };

    if (!isOpen || !member) return null;

    // Determine what the new status will be
    const getStatusPreview = () => {
        if (member.status === 'active') return 'Active';
        const trimmedEmail = email.trim();
        return trimmedEmail ? 'Pending' : 'Placeholder';
    };

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
                            <Avatar member={member} size="md" />
                            <h2 className="text-xl font-semibold text-gray-900">Edit Member</h2>
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

                    {/* Status Info */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Current Status</span>
                            <span className={`font-medium ${member.status === 'active' ? 'text-green-600' :
                                member.status === 'pending' ? 'text-blue-600' :
                                    'text-amber-600'
                                }`}>
                                {member.status === 'active' ? 'Active' :
                                    member.status === 'pending' ? 'Pending' :
                                        'Placeholder'}
                            </span>
                        </div>
                        {canEditEmail && email.trim() !== (member.invited_email || '') && (
                            <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-gray-200">
                                <span className="text-gray-600">After Save</span>
                                <span className={`font-medium ${getStatusPreview() === 'Pending' ? 'text-blue-600' : 'text-amber-600'
                                    }`}>
                                    → {getStatusPreview()}
                                </span>
                            </div>
                        )}
                    </div>

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
                                maxLength={100}
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                            Email Address
                            {member.status === 'active' && (
                                <span className="text-gray-400 font-normal ml-2">(locked for active members)</span>
                            )}
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="email"
                                id="email"
                                value={member.status === 'active' ? (member.email || '') : email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={canEditEmail ? "user@example.com (optional)" : ""}
                                className={`w-full pl-10 pr-4 py-2.5 border rounded-lg ${canEditEmail
                                    ? 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                                    : 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
                                    }`}
                                disabled={isLoading || !canEditEmail}
                                autoComplete="off"
                            />
                        </div>
                        {canEditEmail && (
                            <p className="text-xs text-gray-500">
                                {email.trim()
                                    ? 'They can claim this membership when they sign up with this email'
                                    : 'Leave empty to keep as placeholder member'}
                            </p>
                        )}
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
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
