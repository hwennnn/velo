/**
 * Trip Detail Page (Refactored)
 * Optimized with React Query, broken into smaller components
 */
import { format } from 'date-fns';
import { ArrowLeft, Plus, Settings, TrendingUp, Users, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AddMemberModal } from '../components/AddMemberModal';
import { Avatar } from '../components/Avatar';
import { CreateExpenseModal } from '../components/CreateExpenseModal';
import { ExpenseList } from '../components/ExpenseList';
import { FilterModal } from '../components/FilterModal';
import { InviteModal } from '../components/InviteModal';
import { MemberDetailModal } from '../components/MemberDetailModal';
import { MembersModal } from '../components/MembersModal';
import { TripDetailSkeleton } from '../components/TripDetailSkeleton';
import { useAlert } from '../contexts/AlertContext';
import { useAuth } from '../hooks/useAuth';
import { useBalances } from '../hooks/useBalances';
import { useCreateExpense, useExpenses, type ExpenseFilters } from '../hooks/useExpenses';
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
  // balances/settle up now lives on /trips/:tripId/balances
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [memberMenuOpen, setMemberMenuOpen] = useState<number | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TripMember | null>(null);
  const [showMemberDetail, setShowMemberDetail] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<number | null>(null);
  const [selectedExpenseType, setSelectedExpenseType] = useState('all');

  const { data: trip, isLoading: tripLoading } = useTrip(tripId);

  // Create filters object for expenses
  const expenseFilters: ExpenseFilters = {
    ...(selectedCategory !== 'all' && { category: selectedCategory }),
    ...(selectedMemberFilter && { paid_by_member_id: selectedMemberFilter }),
    ...(selectedExpenseType !== 'all' && { expense_type: selectedExpenseType }),
  };

  const {
    data: expensesData,
    isLoading: expensesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useExpenses(tripId, expenseFilters);

  // Flatten all expenses from all pages
  const expenses = expensesData?.pages.flatMap(page => page.expenses) || [];

  // Get balances (must be called before any early returns)
  const { data: balances = [] } = useBalances(tripId);

  const createExpenseMutation = useCreateExpense(tripId!);
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
      showAlert(message, { type: 'error' });
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
    if (!startDate && !endDate) return '';
    if (startDate && !endDate) return `From ${format(new Date(startDate), 'MMM d, yyyy')}`;
    if (!startDate && endDate) return `Until ${format(new Date(endDate), 'MMM d, yyyy')}`;
    return `${format(new Date(startDate!), 'MMM d')} - ${format(new Date(endDate!), 'MMM d, yyyy')}`;
  };

  const formatCurrency = (amount: number, currency: string) => {
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    return `${currency} ${formatted}`;
  };

  // Show loading skeleton only on initial load (no cached data)
  if (tripLoading && !trip) {
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
  const isCurrentUserAdmin = trip?.members?.find(m => m.user_id === user?.id)?.is_admin || false;

  // Get current user's balance
  const currentUserMember = trip?.members?.find(m => m.user_id === user?.id);
  const currentUserBalance = balances && 'member_balances' in balances ? balances.member_balances.find(b => b.member_id === currentUserMember?.id) : null;
  const netBalance = currentUserBalance?.net_balance || 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      {/* Header */}
      <header className="bg-white px-5 py-4 safe-top shadow-sm border-b border-gray-100">
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => navigate('/trips')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors -ml-2"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 text-center px-4">
            <h1 className="text-xl font-bold text-gray-900">{trip.name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatDateRange(trip.start_date, trip.end_date)}
            </p>
          </div>
          <button
            onClick={() => navigate(`/trips/${tripId}/settings`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {/* Total Spent Card */}
        <div className="px-5 pt-4 pb-3">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            {/* Header with member avatars */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 uppercase tracking-wide font-medium">TOTAL SPENT</p>
              <button
                onClick={() => setShowMembersModal(true)}
                className="flex -space-x-2 hover:opacity-80 transition-opacity"
              >
                {trip.members?.slice(0, 4).map((member) => (
                  <Avatar
                    key={member.id}
                    member={member}
                    size="sm"
                    className="border-2 border-white"
                  />
                ))}
                {(trip.member_count || 0) > 4 && (
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 text-xs font-bold border-2 border-white">
                    +{(trip.member_count || 0) - 4}
                  </div>
                )}
              </button>
            </div>

            {/* Total Amount */}
            <div className="mb-4">
              <h2 className="text-4xl font-bold text-gray-900">
                {formatCurrency(totalSpent, trip.base_currency)}
              </h2>
            </div>

            {/* Balance Indicator */}
            {currentUserBalance && netBalance !== 0 && (
              <div className={`rounded-xl p-3 flex items-center gap-2 ${netBalance > 0
                ? 'bg-green-50'
                : 'bg-red-50'
                }`}>
                <TrendingUp className={`w-4 h-4 ${netBalance > 0 ? 'text-green-600' : 'text-red-600'
                  }`} />
                <span className={`text-sm font-medium ${netBalance > 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                  {netBalance > 0
                    ? `You are owed ${formatCurrency(Math.abs(netBalance), trip.base_currency)}`
                    : `You owe ${formatCurrency(Math.abs(netBalance), trip.base_currency)}`
                  }
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-5 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate(`/trips/${tripId}/balances`)}
              className="bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 border border-gray-100"
            >
              <Wallet className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">Balances</span>
            </button>

            <button
              onClick={() => setShowMembersModal(true)}
              className="bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 border border-gray-100"
            >
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">Members</span>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <ExpenseList
          tripId={tripId!}
          expenses={expenses}
          isLoading={expensesLoading}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={fetchNextPage}
          members={trip.members || []}
          baseCurrency={trip.base_currency}
          currentUserId={user?.id}
          isCurrentUserAdmin={isCurrentUserAdmin}
          selectedCategory={selectedCategory}
          selectedMember={selectedMemberFilter}
          onFilterClick={() => setShowFilterModal(true)}
        />
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowAddExpenseModal(true)}
        className="absolute bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-full hover:from-primary-600 hover:to-primary-700 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center z-50 shadow-lg hover:shadow-xl"
        aria-label="Add expense"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Members Modal */}
      <MembersModal
        isOpen={showMembersModal}
        members={trip.members || []}
        currentUserId={user?.id}
        isCurrentUserAdmin={isCurrentUserAdmin}
        memberMenuOpen={memberMenuOpen}
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
        selectedExpenseType={selectedExpenseType}
        members={trip.members || []}
        onClose={() => setShowFilterModal(false)}
        onApply={(category, memberId, expenseType) => {
          setSelectedCategory(category);
          setSelectedMemberFilter(memberId);
          setSelectedExpenseType(expenseType);
          setShowFilterModal(false);
        }}
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
