/**
 * Home Page - Trips List
 * Shows all user trips and allows creating new ones
 */
import { format } from 'date-fns';
import { Calendar, LogOut, MapPin, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateTripModal from '../components/CreateTripModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import { useCreateTrip, useTrips } from '../hooks/useTrips';
import type { CreateTripInput } from '../types';

export default function Home() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Use React Query hooks
  const { data: trips = [], isLoading } = useTrips();
  const createTripMutation = useCreateTrip();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-primary-600 text-white px-6 py-4 safe-top shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Velo</h1>
            <p className="text-primary-100 text-sm">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 hover:bg-primary-700 rounded-xl transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Your Trips</h2>
            <p className="text-gray-600 text-sm">Manage your travel expenses</p>
          </div>
          {trips.length > 0 && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="p-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm"
              aria-label="Create trip"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>

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
            <h3 className="text-lg font-medium text-gray-900 mb-2">No trips yet</h3>
            <p className="text-gray-500 mb-6">Create your first trip to start tracking expenses</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-sm hover:shadow-md"
            >
              Create Trip
            </button>
          </div>
        ) : (
          /* Trip List */
          <div className="space-y-4">
            {trips.map((trip) => (
              <button
                key={trip.id}
                onClick={() => navigate(`/trips/${trip.id}`)}
                className="w-full bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 text-left"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{trip.name}</h3>
                    {trip.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{trip.description}</p>
                    )}
                  </div>
                  <div className="ml-3 px-3 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                    {trip.base_currency}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {trip.member_count && (
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      <span>{trip.member_count} {trip.member_count === 1 ? 'member' : 'members'}</span>
                    </div>
                  )}
                  {formatDateRange(trip.start_date, trip.end_date) && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation (placeholder) */}
      <nav className="bg-white border-t border-gray-200 safe-bottom shadow-sm">
        <div className="grid grid-cols-4 gap-2 px-4 py-3">
          <button className="flex flex-col items-center gap-1 text-primary-600">
            <div className="w-6 h-6 bg-primary-100 rounded-lg"></div>
            <span className="text-xs font-medium">Trips</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600">
            <div className="w-6 h-6 bg-gray-100 rounded-lg"></div>
            <span className="text-xs font-medium">Expenses</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600">
            <div className="w-6 h-6 bg-gray-100 rounded-lg"></div>
            <span className="text-xs font-medium">Balances</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600">
            <div className="w-6 h-6 bg-gray-100 rounded-lg"></div>
            <span className="text-xs font-medium">Profile</span>
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
