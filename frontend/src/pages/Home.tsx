/**
 * Home Page - Trips List
 * Shows all user trips and allows creating new ones
 */
import { format } from 'date-fns';
import { MapPin, Plus, Settings } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import BottomNavbar from '../components/BottomNavbar';
import CreateTripModal from '../components/CreateTripModal';
import { TripListSkeleton } from '../components/TripListSkeleton';
import { useAuth } from '../hooks/useAuth';
import { useCreateTrip, useTrips } from '../hooks/useTrips';
import type { CreateTripInput } from '../types';
import { formatDateRange } from '../utils/dateUtils';

export default function Home() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();

  // Use React Query hooks
  const { data: trips = [], isLoading } = useTrips();
  const createTripMutation = useCreateTrip(user?.id);

  const handleCreateTrip = async (tripData: CreateTripInput) => {
    await createTripMutation.mutateAsync(tripData);
    setIsModalOpen(false);
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

  return (
    <div className="h-full bg-gray-50 flex flex-col relative">
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
          <div className="pt-1">
            <TripListSkeleton rows={4} />
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
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-sm hover:shadow-md"
            >
              Create Trip
            </button>
          </div>
        ) : (
          /* Trip List */
          <div className="space-y-3">
            {trips.map((trip) => {
              const isOptimistic = trip._isOptimistic === true;
              return (
                <button
                  key={trip._optimisticId || trip.id}
                  onClick={() => !isOptimistic && navigate(`/trips/${trip.id}`)}
                  disabled={isOptimistic}
                  className={`w-full bg-white rounded-xl p-5 shadow-sm transition-all text-left ${isOptimistic
                    ? 'opacity-70 cursor-not-allowed animate-pulse'
                    : 'hover:shadow-md hover:-translate-y-0.5'
                    }`}
                >
                  {/* Header with title and currency */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-0.5">{trip.name}</h3>
                      {formatDateRange(trip.start_date, trip.end_date, format) && (
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          {formatDateRange(trip.start_date, trip.end_date, format)}
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
                      {isOptimistic || !trip.members || trip.members?.length === 0 ? (
                        // Show current user avatar with spinner overlay for optimistic state
                        <div className="relative">
                          <Avatar
                            member={{
                              id: -1,
                              nickname: user?.user_metadata?.display_name || user?.email || 'You',
                              display_name: user?.user_metadata?.display_name,
                              avatar_url: user?.user_metadata?.avatar_url,
                            }}
                            size="sm"
                            className="border-2 border-white"
                          />
                        </div>
                      ) : (
                        <div className="flex -space-x-2">
                          {trip.members.slice(0, 4).map((member) => (
                            <Avatar
                              key={member.id}
                              member={member}
                              size="sm"
                              className="border-2 border-white"
                            />
                          ))}
                          {trip.members.length > 4 && (
                            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-bold border-2 border-white">
                              +{trip.members.length - 4}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Total Spent / Creating Status */}
                    <div className="text-right">
                      {isOptimistic ? (
                        <div className="flex items-center gap-2 justify-end">
                          <p className="text-sm font-medium text-blue-600">Creating...</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-gray-500 mb-0.5">Total Spend</p>
                          <p className="text-xl font-bold text-gray-900">
                            {formatCurrency(trip.total_spent || 0, trip.base_currency)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="absolute bottom-20 right-5 h-11 px-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 z-10 shadow-lg hover:shadow-xl"
        aria-label="Create trip"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm font-semibold">Trip</span>
      </button>

      {/* Bottom Navigation */}
      <BottomNavbar />

      {/* Create Trip Modal */}
      <CreateTripModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateTrip}
      />
    </div>
  );
}
