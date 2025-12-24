/**
 * Trip Detail Page (Refactored)
 * Optimized with React Query, broken into smaller components
 */
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ActionChips } from '../components/ActionChips';
import { AddMemberModal } from '../components/AddMemberModal';
import { BalancesModal } from '../components/BalancesModal';
import { CreateExpenseModal } from '../components/CreateExpenseModal';
import { ExpenseList } from '../components/ExpenseList';
import { ExpenseListSkeleton } from '../components/ExpenseListSkeleton';
import { FilterModal } from '../components/FilterModal';
import { InviteModal } from '../components/InviteModal';
import { MemberDetailModal } from '../components/MemberDetailModal';
import { MembersModal } from '../components/MembersModal';
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
import { getMemberColor, getMemberInitials } from '../utils/memberUtils';

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
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [memberMenuOpen, setMemberMenuOpen] = useState<number | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TripMember | null>(null);
  const [showMemberDetail, setShowMemberDetail] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<number | null>(null);

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
      showAlert('Member removed successfully!', { type: 'success', autoClose: true });
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
      showAlert('Member promoted to admin!', { type: 'success', autoClose: true });
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
          expenseCount={expenseCount}
          totalSpent={totalSpent}
          onMembersClick={() => setShowMembersModal(true)}
          getMemberColor={(index) => getMemberColor(index)}
          getMemberInitials={getMemberInitials}
        />

        {/* Action Chips */}
        <ActionChips
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
              selectedCategory={selectedCategory}
              selectedMember={selectedMemberFilter}
              onDelete={handleDeleteExpense}
              onRefresh={() => {}}
              onFilterClick={() => setShowFilterModal(true)}
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
      <MembersModal
        isOpen={showMembersModal}
        members={trip.members || []}
        currentUserId={user?.id}
        isCurrentUserAdmin={isCurrentUserAdmin}
        memberMenuOpen={memberMenuOpen}
        getMemberColor={getMemberColor}
        getMemberInitials={getMemberInitials}
        onClose={() => setShowMembersModal(false)}
        onMemberClick={(member) => {
          setSelectedMember(member);
          setShowMemberDetail(true);
          setShowMembersModal(false);
        }}
        onMenuToggle={(memberId) => setMemberMenuOpen(memberMenuOpen === memberId ? null : memberId)}
        onClaimMember={handleClaimMember}
        onPromoteToAdmin={handlePromoteToAdmin}
        onDemoteAdmin={handleDemoteAdmin}
        onRemoveMember={handleRemoveMember}
        onLeaveTrip={handleLeaveTrip}
        onInvite={() => {
          setShowMembersModal(false);
          handleGenerateInvite();
        }}
        onAddMember={() => {
          setShowMembersModal(false);
          setShowAddMemberModal(true);
        }}
      />

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

      <FilterModal
        isOpen={showFilterModal}
        selectedCategory={selectedCategory}
        selectedMember={selectedMemberFilter}
        members={trip.members || []}
        onClose={() => setShowFilterModal(false)}
        onCategoryChange={setSelectedCategory}
        onMemberChange={setSelectedMemberFilter}
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
      <InviteModal
        isOpen={showInviteModal}
        inviteLink={inviteLink}
        onClose={() => setShowInviteModal(false)}
        onCopy={handleCopyInvite}
      />

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
