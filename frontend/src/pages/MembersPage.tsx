/**
 * Members Page
 *
 * Full page for managing trip members.
 * Includes add, remove, promote/demote, and invite functionality.
 */
import { ArrowLeft, Link2, Plus, Shield, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AddMemberModal } from '../components/AddMemberModal';
import { Avatar } from '../components/Avatar';
import { EditMemberModal } from '../components/EditMemberModal';
import { InviteModal } from '../components/InviteModal';
import { MemberDetailModal } from '../components/MemberDetailModal';
import { Shimmer } from '../components/Shimmer';
import { useAlert } from '../contexts/AlertContext';
import { useAuth } from '../hooks/useAuth';
import { useAddMember, useLeaveTrip, useRemoveMember, useUpdateMember } from '../hooks/useMembers';
import { useGenerateInvite, useTrip } from '../hooks/useTrips';
import type { AddMemberInput, TripMember } from '../types';

export default function MembersPage() {
    const { tripId } = useParams<{ tripId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useAlert();

    // UI State
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [showEditMemberModal, setShowEditMemberModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [selectedMember, setSelectedMember] = useState<TripMember | null>(null);
    const [showMemberDetail, setShowMemberDetail] = useState(false);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [inviteError, setInviteError] = useState<string | null>(null);

    // Data & Mutations
    const { data: trip, isLoading } = useTrip(tripId);
    const addMemberMutation = useAddMember(tripId!);
    const removeMemberMutation = useRemoveMember(tripId!);
    const updateMemberMutation = useUpdateMember(tripId!);
    const leaveTripMutation = useLeaveTrip(tripId!);
    const generateInviteMutation = useGenerateInvite(tripId!);

    const members = trip?.members || [];
    const currentMember = members.find(m => m.user_id === user?.id);
    const isCurrentUserAdmin = currentMember?.is_admin || false;

    // Handlers
    const handleAddMember = async (memberData: AddMemberInput) => {
        await addMemberMutation.mutateAsync(memberData);
        setShowAddMemberModal(false);
        showAlert('Member added successfully!', { type: 'success', autoClose: true });
    };

    const handleEditMember = async (memberId: number, data: { nickname?: string; email?: string }) => {
        await updateMemberMutation.mutateAsync({ memberId: memberId.toString(), data });
        setShowEditMemberModal(false);
        setSelectedMember(null);
        showAlert('Member updated successfully!', { type: 'success', autoClose: true });
    };

    const handleRemoveMember = async (member: TripMember) => {
        const confirmed = await showConfirm(
            `Remove ${member.nickname} from this trip?${member.status === 'active' ? ' They will lose access to this trip.' : ''}`,
            {
                title: 'Remove Member',
                confirmText: 'Remove',
                confirmButtonClass: 'bg-red-600 hover:bg-red-700',
            }
        );

        if (!confirmed) return;

        try {
            await removeMemberMutation.mutateAsync(member.id.toString());
            showAlert('Member removed successfully!', { type: 'success', autoClose: true });
        } catch (error) {
            const err = error as { response?: { data?: { detail?: string } } };
            showAlert(err.response?.data?.detail || 'Failed to remove member', { type: 'error' });
        }
    };

    const handlePromoteToAdmin = async (member: TripMember) => {
        const confirmed = await showConfirm(
            `Promote ${member.nickname} to admin? They will be able to manage this trip.`,
            {
                title: 'Promote to Admin',
                confirmText: 'Promote',
            }
        );

        if (!confirmed) return;

        try {
            await updateMemberMutation.mutateAsync({ memberId: member.id.toString(), data: { is_admin: true } });
            showAlert('Member promoted to admin!', { type: 'success', autoClose: true });
        } catch (error) {
            const err = error as { response?: { data?: { detail?: string } } };
            showAlert(err.response?.data?.detail || 'Failed to promote member', { type: 'error' });
        }
    };

    const handleDemoteAdmin = async (member: TripMember) => {
        const confirmed = await showConfirm(
            `Remove admin privileges from ${member.nickname}?`,
            {
                title: 'Remove Admin',
                confirmText: 'Remove',
                confirmButtonClass: 'bg-amber-600 hover:bg-amber-700',
            }
        );

        if (!confirmed) return;

        try {
            await updateMemberMutation.mutateAsync({ memberId: member.id.toString(), data: { is_admin: false } });
            showAlert('Admin privileges removed!', { type: 'success', autoClose: true });
        } catch (error) {
            const err = error as { response?: { data?: { detail?: string } } };
            showAlert(err.response?.data?.detail || 'Failed to demote admin', { type: 'error' });
        }
    };

    const handleLeaveTrip = async () => {
        if (!trip) return;

        const confirmed = await showConfirm(
            `Are you sure you want to leave "${trip.name}"? You'll need an invite link to rejoin.`,
            {
                title: 'Leave Trip',
                confirmText: 'Leave',
                confirmButtonClass: 'bg-red-600 hover:bg-red-700',
            }
        );

        if (!confirmed) return;

        try {
            await leaveTripMutation.mutateAsync();
            navigate('/trips');
        } catch (error) {
            const err = error as { response?: { data?: { detail?: string } } };
            showAlert(err.response?.data?.detail || 'Failed to leave trip', { type: 'error' });
        }
    };

    const handleGenerateInvite = async () => {
        setInviteError(null);
        setInviteLink(null);
        setShowInviteModal(true);

        try {
            const url = await generateInviteMutation.mutateAsync();
            setInviteLink(url);
        } catch (error) {
            const err = error as { response?: { data?: { detail?: string } } };
            const message = err.response?.data?.detail || 'Failed to generate invite link';
            setInviteError(message);
        }
    };

    const handleCopyInvite = () => {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink);
            showAlert('Invite link copied to clipboard!', { type: 'success', autoClose: true });
        }
    };

    const getStatusBadge = (member: TripMember) => {
        if (member.status === 'placeholder') {
            return <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">Placeholder</span>;
        }
        if (member.status === 'pending') {
            return <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">Pending</span>;
        }
        return null;
    };

    if (!tripId) return null;

    return (
        <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
                <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(`/trips/${tripId}`)}
                            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-700" />
                        </button>
                        <div>
                            <div className="text-lg font-semibold text-gray-900">Members</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                <Users className="w-3 h-3 text-gray-400" />
                                <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {isCurrentUserAdmin && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleGenerateInvite}
                                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                title="Generate invite link"
                            >
                                <Link2 className="w-5 h-5 text-gray-600" />
                            </button>
                            <button
                                onClick={() => setShowAddMemberModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-5 py-4 pb-4">
                    {isLoading ? (
                        // Loading skeleton
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                                    <div className="flex items-center gap-3">
                                        <Shimmer className="w-12 h-12 rounded-full" />
                                        <div className="flex-1">
                                            <Shimmer className="h-4 rounded w-32 mb-2" />
                                            <Shimmer className="h-3 rounded w-24" />
                                        </div>
                                        <Shimmer className="h-6 rounded w-16" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : members.length === 0 ? (
                        // Empty state
                        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No members in this trip</p>
                            {isCurrentUserAdmin && (
                                <button
                                    onClick={() => setShowAddMemberModal(true)}
                                    className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                                >
                                    Add First Member
                                </button>
                            )}
                        </div>
                    ) : (
                        // Member list
                        <div className="space-y-2">
                            {members.map((member) => {
                                const isCurrentUser = member.user_id === user?.id;

                                return (
                                    <div
                                        key={member.id}
                                        className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Avatar */}
                                            <button
                                                onClick={() => {
                                                    setSelectedMember(member);
                                                    setShowMemberDetail(true);
                                                }}
                                                className="flex-shrink-0"
                                            >
                                                <Avatar member={member} size="md" />
                                            </button>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900 truncate">
                                                        {member.nickname}
                                                    </span>
                                                    {isCurrentUser && (
                                                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                                                            You
                                                        </span>
                                                    )}
                                                    {member.is_admin && (
                                                        <Shield className="w-4 h-4 text-primary-600" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {getStatusBadge(member)}
                                                    {member.status === 'pending' && member.invited_email && (
                                                        <span className="text-xs text-gray-500 truncate">{member.invited_email}</span>
                                                    )}
                                                    {member.status === 'active' && member.email && (
                                                        <span className="text-xs text-gray-500 truncate">{member.email}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1">
                                                {isCurrentUserAdmin && !isCurrentUser && member.status === 'active' && (
                                                    <>
                                                        {member.is_admin ? (
                                                            <button
                                                                onClick={() => handleDemoteAdmin(member)}
                                                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors text-xs font-medium"
                                                                title="Remove admin"
                                                            >
                                                                Demote
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handlePromoteToAdmin(member)}
                                                                className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors text-xs font-medium"
                                                                title="Make admin"
                                                            >
                                                                Promote
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                {isCurrentUserAdmin && !isCurrentUser && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedMember(member);
                                                            setShowEditMemberModal(true);
                                                        }}
                                                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-xs font-medium"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                                {isCurrentUserAdmin && !isCurrentUser && (
                                                    <button
                                                        onClick={() => handleRemoveMember(member)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-medium"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                                {isCurrentUser && (
                                                    <button
                                                        onClick={handleLeaveTrip}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-medium"
                                                    >
                                                        Leave
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <AddMemberModal
                isOpen={showAddMemberModal}
                onClose={() => setShowAddMemberModal(false)}
                onAdd={handleAddMember}
                existingMembers={members}
            />

            <MemberDetailModal
                isOpen={showMemberDetail}
                member={selectedMember}
                isCurrentUser={selectedMember?.user_id === user?.id}
                onClose={() => {
                    setShowMemberDetail(false);
                    setSelectedMember(null);
                }}
            />

            <EditMemberModal
                isOpen={showEditMemberModal}
                member={selectedMember}
                existingMembers={members}
                onClose={() => {
                    setShowEditMemberModal(false);
                    setSelectedMember(null);
                }}
                onSave={handleEditMember}
            />

            <InviteModal
                isOpen={showInviteModal}
                inviteLink={inviteLink}
                isLoading={generateInviteMutation.isPending}
                error={inviteError}
                onClose={() => {
                    setShowInviteModal(false);
                    setInviteError(null);
                }}
                onCopy={handleCopyInvite}
                onRetry={handleGenerateInvite}
            />
        </div>
    );
}
