/**
 * Trip Detail Page (Refactored)
 * Optimized with React Query, broken into smaller components
 */
import { format } from 'date-fns';
import { ArrowLeft, HandCoins, Plus, Settings, TrendingUp, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { CreateExpenseModal } from '../components/CreateExpenseModal';
import { ExpenseList } from '../components/ExpenseList';
import { FilterModal } from '../components/FilterModal';
import { TripDetailSkeleton } from '../components/TripDetailSkeleton';
import { useAuth } from '../hooks/useAuth';
import { useBalances } from '../hooks/useBalances';
import { useCreateExpense, useExpenses, type ExpenseFilters } from '../hooks/useExpenses';
import { useTrip } from '../hooks/useTrips';
import type { CreateExpenseInput } from '../types';
import { formatDateRange } from '../utils/dateUtils';

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
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

  const createExpenseMutation = useCreateExpense(tripId!, trip?.members, user?.id);

  const handleCreateExpense = async (expenseData: CreateExpenseInput) => {
    await createExpenseMutation.mutateAsync(expenseData);
    setShowAddExpenseModal(false);
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
              {formatDateRange(trip.start_date, trip.end_date, format)}
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
                onClick={() => navigate(`/trips/${tripId}/members`)}
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
              onClick={() => navigate(`/trips/${tripId}/settle-up`)}
              className="bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 border border-gray-100"
            >
              <HandCoins className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">Settle Up</span>
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
        className="absolute bottom-6 right-6 h-11 px-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 z-10 shadow-lg hover:shadow-xl"
        aria-label="Add expense"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm font-semibold">Expense</span>
      </button>


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
    </div>
  );
}
