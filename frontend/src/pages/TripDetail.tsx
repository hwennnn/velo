/**
 * Trip Detail Page (Refactored)
 * Optimized with React Query, broken into smaller components
 */
import { format } from 'date-fns';
import { Copy, Link2, LogOut, MoreVertical, Plus, Shield, Trash2, UserCheck, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AddMemberModal } from '../components/AddMemberModal';
import { BalancesModal } from '../components/BalancesModal';
import { CreateExpenseModal } from '../components/CreateExpenseModal';
import { ExpenseList } from '../components/ExpenseList';
import { ExpenseListSkeleton } from '../components/ExpenseListSkeleton';
import { MemberDetailModal } from '../components/MemberDetailModal';
import { QuickStats } from '../components/QuickStats';
import { SettlementsModal } from '../components/SettlementsModal';
import { TripDetailSkeleton } from '../components/TripDetailSkeleton';
import { TripHeader } from '../components/TripHeader';
import { TripInfoCard } from '../components/TripInfoCard';
import { useAlert } from '../contexts/AlertContext';
import { useAuth } from '../hooks/useAuth';
import { useBalances, useSettlements } from '../hooks/useBalances';
import { useCreateExpense, useDeleteExpense, useExpenses } from '../hooks/useExpenses';
import { useAddMember, useClaimMember, useLeaveTrip, useRemoveMember, useUpdateMember } from '../hooks/useMembers';
import { useGenerateInvite, useTrip } from '../hooks/useTrips';
import type { AddMemberInput, CreateExpenseInput, TripMember } from '../types';

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert, showConfirm } = useAlert();

  // UI State - Declare before hooks that depend on them
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showBalancesModal, setShowBalancesModal] = useState(false);
  const [showSettlementsModal, setShowSettlementsModal] = useState(false);
  const [memberMenuOpen, setMemberMenuOpen] = useState<number | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TripMember | null>(null);
  const [showMemberDetail, setShowMemberDetail] = useState(false);

  // React Query hooks - Parallel fetching for optimal performance
  const { data: trip, isLoading: tripLoading, isFetching: tripFetching } = useTrip(tripId);
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses(tripId);
  
  // Lazy load balances and settlements - only fetch when modals are opened
  const { data: balances = [], isLoading: balancesLoading } = useBalances(showBalancesModal ? tripId : undefined);
  const { data: settlements = [], isLoading: settlementsLoading } = useSettlements(showSettlementsModal ? tripId : undefined);
  
  const createExpenseMutation = useCreateExpense(tripId!);
  const deleteExpenseMutation = useDeleteExpense(tripId!);
  const addMemberMutation = useAddMember(tripId!);
  const removeMemberMutation = useRemoveMember(tripId!);
  const claimMemberMutation = useClaimMember(tripId!);
  const updateMemberMutation = useUpdateMember(tripId!);
  const leaveTripMutation = useLeaveTrip(tripId!);
  const generateInviteMutation = useGenerateInvite(tripId!);

  const handleAddMember = async (memberData: AddMemberInput) => {
    await addMemberMutation.mutateAsync(memberData);
    setShowAddMemberModal(false);
  };

  const handleCreateExpense = async (expenseData: CreateExpenseInput) => {
    await createExpenseMutation.mutateAsync(expenseData);
    setShowAddExpenseModal(false);
  };

  const handleDeleteExpense = async (expenseId: number) => {
    await deleteExpenseMutation.mutateAsync(expenseId);
  };

  const handleRemoveMember = async (memberId: number, memberName: string) => {
    const confirmed = await showConfirm(`Remove ${memberName} from this trip?`, {
      title: 'Remove Member',
      confirmText: 'Remove',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });

    if (!confirmed) return;

    try {
      await removeMemberMutation.mutateAsync(memberId.toString());
      setMemberMenuOpen(null);
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      showAlert(err.response?.data?.detail || 'Failed to remove member', { type: 'error' });
    }
  };

  const handleClaimMember = async (memberId: number) => {
    const confirmed = await showConfirm('Claim this fictional member as yourself? Your current expenses and balances will be merged into this member.', {
      title: 'Claim Member',
      confirmText: 'Claim',
    });

    if (!confirmed) return;

    try {
      await claimMemberMutation.mutateAsync(memberId.toString());
      setMemberMenuOpen(null);
      showAlert('Member claimed successfully!', { type: 'success', autoClose: true });
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      showAlert(err.response?.data?.detail || 'Failed to claim member', { type: 'error' });
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const url = await generateInviteMutation.mutateAsync();
      setInviteLink(url);
      setShowInviteModal(true);
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      showAlert(err.response?.data?.detail || 'Failed to generate invite link', { type: 'error' });
    }
  };

  const handleCopyInvite = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      showAlert('Invite link copied to clipboard!', { type: 'success', autoClose: true });
    }
  };

  const handlePromoteToAdmin = async (memberId: number, memberName: string) => {
    const confirmed = await showConfirm(
      `Promote ${memberName} to admin? They will be able to manage this trip.`,
      {
        title: 'Promote to Admin',
        confirmText: 'Promote',
      }
    );

    if (!confirmed) return;

    try {
      await updateMemberMutation.mutateAsync({ memberId: memberId.toString(), data: { is_admin: true } });
      setMemberMenuOpen(null);
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      showAlert(err.response?.data?.detail || 'Failed to promote member', { type: 'error' });
    }
  };

  const handleDemoteAdmin = async (memberId: number, memberName: string) => {
    const confirmed = await showConfirm(`Remove admin privileges from ${memberName}?`, {
      title: 'Remove Admin',
      confirmText: 'Remove',
      confirmButtonClass: 'bg-amber-600 hover:bg-amber-700',
    });

    if (!confirmed) return;

    try {
      await updateMemberMutation.mutateAsync({ memberId: memberId.toString(), data: { is_admin: false } });
      setMemberMenuOpen(null);
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

  const formatDateRange = (startDate?: string, endDate?: string) => {
    if (!startDate && !endDate) return 'No dates set';
    if (startDate && !endDate) return `From ${format(new Date(startDate), 'MMM d, yyyy')}`;
    if (!startDate && endDate) return `Until ${format(new Date(endDate), 'MMM d, yyyy')}`;
    return `${format(new Date(startDate!), 'MMM d')} - ${format(new Date(endDate!), 'MMM d, yyyy')}`;
  };

  // Show loading skeleton only on initial load (no cached data)
  if ((tripLoading || expensesLoading) && !trip && expenses.length === 0) {
    return <TripDetailSkeleton />;
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Trip not found</h2>
          <button
            onClick={() => navigate('/trips')}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Back to trips
          </button>
        </div>
      </div>
    );
  }

  // Get member colors for avatars
  const getMemberColor = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-teal-500',
    ];
    return colors[index % colors.length];
  };

  const getMemberInitials = (nickname: string) => {
    return nickname
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const hasAvailableActions = (member: TripMember) => {
    const currentUserMember = trip?.members?.find(m => m.user_id === user?.id);
    const isAdmin = currentUserMember?.is_admin || false;
    const isNotSelf = member.user_id !== user?.id;

    if (member.is_fictional) return true;
    if (isAdmin && isNotSelf) return true;
    if (member.user_id === user?.id) return true;

    return false;
  };

  const totalSpent = trip?.total_spent || 0;
  const expenseCount = trip?.expense_count || 0;
  const isCurrentUserAdmin = trip?.members?.find(m => m.user_id === user?.id)?.is_admin || false;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <TripHeader
        tripName={trip.name}
        isLoading={tripFetching || expensesLoading}
        onBack={() => navigate('/trips')}
      />

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {/* Trip Info Card */}
        <TripInfoCard
          currency={trip.base_currency}
          dateRange={formatDateRange(trip.start_date, trip.end_date)}
          memberCount={trip.member_count || 0}
          members={trip.members || []}
          onMembersClick={() => setShowMembersModal(true)}
          getMemberColor={(index) => getMemberColor(index)}
          getMemberInitials={getMemberInitials}
        />

        {/* Quick Stats & Action Chips */}
        <QuickStats
          expenseCount={expenseCount}
          totalSpent={totalSpent}
          currency={trip.base_currency}
          onBalancesClick={() => setShowBalancesModal(true)}
          onSettlementsClick={() => setShowSettlementsModal(true)}
        />

        {/* Main Content - Expenses List */}
        <div className="px-4 pb-6">
          {expensesLoading && expenses.length === 0 ? (
            <ExpenseListSkeleton />
          ) : (
            <ExpenseList
              expenses={expenses}
              members={trip.members || []}
              baseCurrency={trip.base_currency}
              currentUserId={user?.id}
              isCurrentUserAdmin={isCurrentUserAdmin}
              onDelete={handleDeleteExpense}
              onRefresh={() => {}}
            />
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowAddExpenseModal(true)}
        className="fixed bottom-20 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-all hover:scale-110 flex items-center justify-center z-20"
        aria-label="Add expense"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Members Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
            onClick={() => setShowMembersModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl animate-slideUp sm:animate-fadeIn max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Trip Members</h3>
              <button
                onClick={() => setShowMembersModal(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {trip.members && trip.members.length > 0 ? (
                <div className="space-y-2">
                  {trip.members.map((member, index) => (
                    <div
                      key={member.id}
                      className="bg-gray-50 rounded-xl p-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
                    >
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => {
                          setSelectedMember(member);
                          setShowMemberDetail(true);
                          setShowMembersModal(false);
                        }}
                      >
                        <div
                          className={`w-10 h-10 ${getMemberColor(index)} rounded-full flex items-center justify-center text-white font-semibold text-sm`}
                        >
                          {getMemberInitials(member.nickname)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 flex items-center gap-2 text-sm">
                            <span className="truncate">{member.nickname}</span>
                            {member.user_id === user?.id && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                me
                              </span>
                            )}
                            {member.is_admin && (
                              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                                Admin
                              </span>
                            )}
                          </div>
                          {member.is_fictional ? (
                            <div className="text-xs text-amber-600 font-medium">Fictional member</div>
                          ) : (
                            <div className="text-xs text-gray-500 truncate">{member.email || 'Active member'}</div>
                          )}
                        </div>
                      </div>

                      {hasAvailableActions(member) && (
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMemberMenuOpen(memberMenuOpen === member.id ? null : member.id);
                            }}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-600" />
                          </button>

                          {memberMenuOpen === member.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setMemberMenuOpen(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                              {member.is_fictional && (
                                <button
                                  onClick={() => handleClaimMember(member.id)}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                >
                                  <UserCheck className="w-4 h-4" />
                                  Claim Member
                                </button>
                              )}

                              {trip.members?.find(m => m.user_id === user?.id)?.is_admin && 
                               member.user_id !== user?.id && 
                               !member.is_fictional && (
                                <>
                                  {!member.is_admin ? (
                                    <button
                                      onClick={() => handlePromoteToAdmin(member.id, member.nickname)}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <Shield className="w-4 h-4" />
                                      Promote to Admin
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleDemoteAdmin(member.id, member.nickname)}
                                      className="w-full px-4 py-2 text-left text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2"
                                    >
                                      <Shield className="w-4 h-4" />
                                      Remove Admin
                                    </button>
                                  )}
                                </>
                              )}

                              {trip.members?.find(m => m.user_id === user?.id)?.is_admin && 
                               member.user_id !== user?.id && (
                                <button
                                  onClick={() => handleRemoveMember(member.id, member.nickname)}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Remove Member
                                </button>
                              )}

                              {member.user_id === user?.id && (
                                <button
                                  onClick={handleLeaveTrip}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-200"
                                >
                                  <LogOut className="w-4 h-4" />
                                  Leave Trip
                                </button>
                              )}
                            </div>
                          </>
                        )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">No members yet</p>
                </div>
              )}
            </div>

            {isCurrentUserAdmin && (
              <div className="p-4 border-t border-gray-200 flex gap-2">
                <button 
                  onClick={() => {
                    setShowMembersModal(false);
                    handleGenerateInvite();
                  }}
                  className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Link2 className="w-4 h-4" />
                  Invite
                </button>
                <button 
                  onClick={() => {
                    setShowMembersModal(false);
                    setShowAddMemberModal(true);
                  }}
                  className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Member
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <AddMemberModal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        onAdd={handleAddMember}
        existingMembers={trip.members || []}
      />

      <CreateExpenseModal
        isOpen={showAddExpenseModal}
        onClose={() => setShowAddExpenseModal(false)}
        onCreate={handleCreateExpense}
        members={trip.members || []}
        baseCurrency={trip.base_currency}
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

      {/* Invite Link Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
            onClick={() => setShowInviteModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl animate-slideUp sm:animate-fadeIn">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Invite Link</h3>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Share this link with others to invite them to this trip:
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteLink || ''}
                  readOnly
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700"
                />
                <button
                  onClick={handleCopyInvite}
                  className="px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
              </div>

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-900">
                  💡 Anyone with this link can join the trip. The link contains the trip ID.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Balances Modal */}
      <BalancesModal
        isOpen={showBalancesModal}
        balances={balances}
        isLoading={balancesLoading}
        currency={trip.base_currency}
        getMemberColor={(memberId) => {
          const index = trip.members?.findIndex(m => m.id === memberId) || 0;
          return getMemberColor(index);
        }}
        onClose={() => setShowBalancesModal(false)}
      />

      {/* Settlements Modal */}
      <SettlementsModal
        isOpen={showSettlementsModal}
        settlements={settlements}
        isLoading={settlementsLoading}
        currency={trip.base_currency}
        getMemberColor={(memberId) => {
          const index = trip.members?.findIndex(m => m.id === memberId) || 0;
          return getMemberColor(index);
        }}
        onClose={() => setShowSettlementsModal(false)}
      />
    </div>
  );
}
