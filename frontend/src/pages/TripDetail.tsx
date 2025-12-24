/**
 * Trip Detail Page
 * Shows trip information, members, expenses, and settlements
 */
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Copy, DollarSign, Link2, LogOut, MoreVertical, Plus, Receipt, Scale, Settings, Shield, Trash2, UserCheck, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AddMemberModal } from '../components/AddMemberModal';
import { CreateExpenseModal } from '../components/CreateExpenseModal';
import { ExpenseList } from '../components/ExpenseList';
import { MemberDetailModal } from '../components/MemberDetailModal';
import { SettlementView } from '../components/SettlementView';
import { useAlert } from '../contexts/AlertContext';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import type { AddMemberInput, CreateExpenseInput, Expense, Trip, TripMember } from '../types';

type TabType = 'members' | 'expenses' | 'settlements';

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('members');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [memberMenuOpen, setMemberMenuOpen] = useState<number | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TripMember | null>(null);
  const [showMemberDetail, setShowMemberDetail] = useState(false);

  useEffect(() => {
    if (tripId) {
      loadData();
    }
  }, [tripId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [tripRes, expensesRes] = await Promise.all([
        api.trips.getById(tripId!),
        api.expenses.getAll(tripId!),
      ]);
      setTrip(tripRes.data);
      setExpenses(expensesRes.data.expenses || []);
    } catch (error) {
      console.error('Error loading trip:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async (memberData: AddMemberInput) => {
    try {
      await api.members.add(tripId!, memberData);
      await loadData();
    } catch (error) {
      throw error;
    }
  };

  const handleCreateExpense = async (expenseData: CreateExpenseInput) => {
    try {
      await api.expenses.create(tripId!, expenseData);
      await loadData();
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteExpense = async (expenseId: number) => {
    try {
      await api.expenses.delete(tripId!, expenseId);
      await loadData();
    } catch (error) {
      throw error;
    }
  };

  const handleRemoveMember = async (memberId: number, memberName: string) => {
    const confirmed = await showConfirm(`Remove ${memberName} from this trip?`, {
      title: 'Remove Member',
      confirmText: 'Remove',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    });

    if (!confirmed) return;

    try {
      await api.members.remove(tripId!, memberId.toString());
      await loadData();
      setMemberMenuOpen(null);
    } catch (error: any) {
      showAlert(error.response?.data?.detail || 'Failed to remove member', { type: 'error' });
    }
  };

  const handleClaimMember = async (memberId: number) => {
    const confirmed = await showConfirm('Claim this fictional member as yourself? Your current expenses and balances will be merged into this member.', {
      title: 'Claim Member',
      confirmText: 'Claim',
    });

    if (!confirmed) return;

    try {
      await api.members.claim(tripId!, memberId.toString());
      await loadData();
      setMemberMenuOpen(null);
      showAlert('Member claimed successfully!', { type: 'success', autoClose: true });
    } catch (error: any) {
      showAlert(error.response?.data?.detail || 'Failed to claim member', { type: 'error' });
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const response = await api.trips.generateInvite(tripId!);
      setInviteLink(response.data.invite_url);
      setShowInviteModal(true);
    } catch (error: any) {
      showAlert(error.response?.data?.detail || 'Failed to generate invite link', { type: 'error' });
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
      await api.members.update(tripId!, memberId.toString(), { is_admin: true });
      await loadData();
      setMemberMenuOpen(null);
    } catch (error: any) {
      showAlert(error.response?.data?.detail || 'Failed to promote member', { type: 'error' });
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
      await api.members.update(tripId!, memberId.toString(), { is_admin: false });
      await loadData();
      setMemberMenuOpen(null);
    } catch (error: any) {
      showAlert(error.response?.data?.detail || 'Failed to demote admin', { type: 'error' });
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
      await api.members.leave(tripId!);
      // Redirect to trips list after leaving
      navigate('/trips');
    } catch (error: any) {
      showAlert(error.response?.data?.detail || 'Failed to leave trip', { type: 'error' });
    }
  };

  const formatDateRange = (startDate?: string, endDate?: string) => {
    if (!startDate && !endDate) return 'No dates set';
    if (startDate && !endDate) return `From ${format(new Date(startDate), 'MMM d, yyyy')}`;
    if (!startDate && endDate) return `Until ${format(new Date(endDate), 'MMM d, yyyy')}`;
    return `${format(new Date(startDate!), 'MMM d')} - ${format(new Date(endDate!), 'MMM d, yyyy')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white px-6 py-4 border-b border-gray-200">
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
        </header>
        <div className="flex-1 p-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="h-48 bg-gray-200 rounded-2xl animate-pulse"></div>
        </div>
      </div>
    );
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

    // Can claim fictional members
    if (member.is_fictional) {
      return true;
    }

    // Admins can manage other members (not themselves)
    if (isAdmin && isNotSelf) {
      return true;
    }

    // Can leave trip if it's yourself
    if (member.user_id === user?.id) {
      return true;
    }

    return false;
  };

  const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount_in_base_currency, 0);

  // Check if current user is admin
  const isCurrentUserAdmin = trip?.members?.find(m => m.user_id === user?.id)?.is_admin || false;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/trips')}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            aria-label="Back to trips"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 flex-1">Trip Details</h1>
          <button
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            aria-label="Trip settings"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {/* Trip Info Card */}
        <div className="bg-gradient-to-br from-primary-500 to-primary-700 p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">{trip.name}</h2>
          {trip.description && (
            <p className="text-primary-100 mb-4">{trip.description}</p>
          )}
          
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span className="font-medium">{trip.base_currency}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 p-6">
          <button 
            onClick={() => setActiveTab('expenses')}
            className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-center"
          >
            <div className="text-2xl font-bold text-gray-900">{expenses.length}</div>
            <div className="text-xs text-gray-600 mt-1">Expenses</div>
          </button>
          <button 
            onClick={() => setActiveTab('expenses')}
            className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-center"
          >
            <div className="text-2xl font-bold text-gray-900">{trip.base_currency} {totalSpent.toFixed(0)}</div>
            <div className="text-xs text-gray-600 mt-1">Total Spent</div>
          </button>
          <button 
            onClick={() => setActiveTab('members')}
            className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-center"
          >
            <div className="text-2xl font-bold text-gray-900">{trip.member_count || 0}</div>
            <div className="text-xs text-gray-600 mt-1">Members</div>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 mb-4">
          <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setActiveTab('members')}
              className={`flex-1 px-4 py-2.5 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'members'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Users className="w-4 h-4" />
              Members
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`flex-1 px-4 py-2.5 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'expenses'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Receipt className="w-4 h-4" />
              Expenses
            </button>
            <button
              onClick={() => setActiveTab('settlements')}
              className={`flex-1 px-4 py-2.5 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'settlements'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Scale className="w-4 h-4" />
              Balances
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-6 pb-6">
          {/* Members Tab */}
          {activeTab === 'members' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Trip Members</h3>
                {isCurrentUserAdmin && (
                  <div className="flex gap-2">
                    <button 
                      onClick={handleGenerateInvite}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2"
                    >
                      <Link2 className="w-4 h-4" />
                      Invite
                    </button>
                    <button 
                      onClick={() => setShowAddMemberModal(true)}
                      className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Member
                    </button>
                  </div>
                )}
              </div>

              {trip.members && trip.members.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
                  {trip.members.map((member, index) => (
                    <div
                      key={member.id}
                      className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => {
                          setSelectedMember(member);
                          setShowMemberDetail(true);
                        }}
                      >
                        <div
                          className={`w-12 h-12 ${getMemberColor(index)} rounded-full flex items-center justify-center text-white font-semibold text-sm`}
                        >
                          {getMemberInitials(member.nickname)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            {member.nickname}
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
                            <div className="text-sm text-amber-600 font-medium">Fictional member</div>
                          ) : member.display_name && member.display_name !== member.nickname ? (
                            <div className="text-sm text-gray-500">
                              {member.display_name} • {member.email}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">{member.email || 'Active member'}</div>
                          )}
                        </div>
                      </div>

                      {/* Member Actions */}
                      {hasAvailableActions(member) && (
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMemberMenuOpen(memberMenuOpen === member.id ? null : member.id);
                            }}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-5 h-5 text-gray-600" />
                          </button>

                          {memberMenuOpen === member.id && (
                          <>
                            {/* Backdrop to close menu */}
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setMemberMenuOpen(null)}
                            />
                            {/* Menu */}
                            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                              {/* Claim fictional member */}
                              {member.is_fictional && (
                                <button
                                  onClick={() => handleClaimMember(member.id)}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                >
                                  <UserCheck className="w-4 h-4" />
                                  Claim Member
                                </button>
                              )}

                              {/* Promote/Demote admin (only for admins, can't target yourself) */}
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

                              {/* Remove member (only for admins, can't target yourself) */}
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

                              {/* Leave trip (only for yourself) */}
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
                <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <Users className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 text-sm mb-4">No members yet</p>
                  {isCurrentUserAdmin && (
                    <button 
                      onClick={() => setShowAddMemberModal(true)}
                      className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
                    >
                      Add First Member
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Expenses Tab */}
          {activeTab === 'expenses' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Trip Expenses</h3>
                <button 
                  onClick={() => setShowAddExpenseModal(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Expense
                </button>
              </div>

              <ExpenseList
                expenses={expenses}
                members={trip.members || []}
                baseCurrency={trip.base_currency}
                currentUserId={user?.id}
                isCurrentUserAdmin={isCurrentUserAdmin}
                onDelete={handleDeleteExpense}
                onRefresh={loadData}
              />
            </div>
          )}

          {/* Settlements Tab */}
          {activeTab === 'settlements' && (
            <SettlementView
              tripId={tripId!}
              members={trip.members || []}
              baseCurrency={trip.base_currency}
            />
          )}
        </div>
      </main>

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
    </div>
  );
}
