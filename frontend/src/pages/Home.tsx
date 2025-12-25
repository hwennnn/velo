/**
 * Home Page - Trips List
 * Shows all user trips and allows creating new ones
 */
import { format } from 'date-fns';
import { List, MapPin, Plus, Settings, User, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateTripModal from '../components/CreateTripModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useCreateTrip, useTrips } from '../hooks/useTrips';
import type { CreateTripInput, TripMember } from '../types';

export default function Home() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Use React Query hooks
  const { data: trips = [], isLoading } = useTrips();
  const createTripMutation = useCreateTrip();

  const handleCreateTrip = async (tripData: CreateTripInput) => {
    await createTripMutation.mutateAsync(tripData);
    setIsModalOpen(false);
  };

  const formatDateRange = (startDate?: string, endDate?: string) => {
    if (!startDate && !endDate) return null;
    if (startDate && !endDate) return `From ${format(new Date(startDate), 'MMM d, yyyy')}`;
    if (!startDate && endDate) return `Until ${format(new Date(endDate), 'MMM d, yyyy')}`;
    return `${format(new Date(startDate!), 'MMM d')} - ${format(new Date(endDate!), 'MMM d, yyyy')}`;
  };

  const formatCurrency = (amount: number, currency: string) => {
    const currencySymbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'SGD': '$',
      'THB': '฿',
    };
    
    const symbol = currencySymbols[currency] || currency;
    const formatted = amount.toLocaleString('en-US', { 
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2 
    });
    
    return `${symbol}${formatted}`;
  };

  const getMemberColor = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-orange-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-cyan-500',
    ];
    return colors[index % colors.length];
  };

  const getMemberInitials = (member: TripMember) => {
    if (member.display_name) {
      return member.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return member.nickname.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      {/* Header */}
      <header className="bg-white px-5 py-4 safe-top shadow-sm border-b border-gray-100">
        <div className="flex items-start justify-between mt-4 mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-0.5">Your Trips</h1>
            <p className="text-gray-500 text-sm">Manage your shared expenses</p>
          </div>
          <button
            onClick={() => navigate('/account')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-5 pt-4 pb-20 overflow-y-auto relative">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" text="Loading trips..." />
          </div>
        ) : trips.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center">
              <MapPin className="w-10 h-10 text-primary-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No trips yet
            </h3>
            <p className="text-gray-500 mb-6">
            Create your first trip to start tracking expenses
            </p>
            (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-sm hover:shadow-md"
              >
                Create Trip
              </button>
            )
          </div>
        ) : (
          /* Trip List */
          <div className="space-y-3">
            {trips.map((trip) => (
              <button
                key={trip.id}
                onClick={() => navigate(`/trips/${trip.id}`)}
                className="w-full bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 text-left"
              >
                {/* Header with title and currency */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-0.5">{trip.name}</h3>
                    {formatDateRange(trip.start_date, trip.end_date) && (
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        {formatDateRange(trip.start_date, trip.end_date)}
                      </p>
                    )}
                  </div>
                  <div className="ml-3 px-2.5 py-1 bg-primary-50 text-primary-600 text-xs font-semibold rounded-lg">
                    {trip.base_currency}
                  </div>
                </div>

                {/* Members and Total Spent */}
                <div className="flex items-center justify-between mt-3">
                  {/* Member Avatars */}
                  <div className="flex items-center">
                    {trip.members && trip.members.length > 0 ? (
                      <div className="flex -space-x-2">
                        {trip.members.slice(0, 4).map((member, idx) => (
                          <div
                            key={member.id}
                            className={`w-8 h-8 rounded-full ${getMemberColor(idx)} flex items-center justify-center text-white text-xs font-bold border-2 border-white`}
                          >
                            {getMemberInitials(member)}
                          </div>
                        ))}
                        {trip.members.length > 4 && (
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-bold border-2 border-white">
                            +{trip.members.length - 4}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">{trip.member_count || 0}</span>
                      </div>
                    )}
                  </div>

                  {/* Total Spent */}
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-0.5">Total Spend</p>
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(trip.total_spent || 0, trip.base_currency)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          )}
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="absolute bottom-20 right-5 w-12 h-12 bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-10"
        aria-label="Create trip"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom shadow-lg z-20">
        <div className="grid grid-cols-2 gap-1 px-4 py-2">
          <button className="flex flex-col items-center gap-1 py-2 text-primary-600 transition-colors">
            <List className="w-5 h-5" />
            <span className="text-xs font-medium">Trips</span>
          </button>
          <button 
            onClick={() => navigate('/account')}
            className="flex flex-col items-center gap-1 py-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <User className="w-5 h-5" />
            <span className="text-xs font-medium">Account</span>
          </button>
        </div>
      </nav>

      {/* Create Trip Modal */}
      <CreateTripModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateTrip}
      />
    </div>
  );
}
