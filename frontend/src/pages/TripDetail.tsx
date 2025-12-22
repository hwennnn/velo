/**
 * Trip Detail Page
 * Shows trip information and members
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Users, DollarSign, Calendar, Settings } from 'lucide-react';
import { api } from '../services/api';
import type { Trip } from '../types';
import { format } from 'date-fns';

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tripId) {
      loadTrip();
    }
  }, [tripId]);

  const loadTrip = async () => {
    try {
      setIsLoading(true);
      const response = await api.trips.getById(tripId!);
      setTrip(response.data);
    } catch (error) {
      console.error('Error loading trip:', error);
    } finally {
      setIsLoading(false);
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
      <main className="flex-1 overflow-y-auto">
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
          <button className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-center">
            <div className="text-2xl font-bold text-gray-900">0</div>
            <div className="text-xs text-gray-600 mt-1">Expenses</div>
          </button>
          <button className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-center">
            <div className="text-2xl font-bold text-gray-900">{trip.base_currency} 0</div>
            <div className="text-xs text-gray-600 mt-1">Total Spent</div>
          </button>
          <button className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-center">
            <div className="text-2xl font-bold text-gray-900">{trip.member_count || 0}</div>
            <div className="text-xs text-gray-600 mt-1">Members</div>
          </button>
        </div>

        {/* Members Section */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Members
            </h3>
            <button className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Member
            </button>
          </div>

          {trip.members && trip.members.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
              {trip.members.map((member, index) => (
                <div
                  key={member.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 ${getMemberColor(index)} rounded-full flex items-center justify-center text-white font-semibold text-sm`}
                    >
                      {getMemberInitials(member.nickname)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        {member.nickname}
                        {member.is_admin && (
                          <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                            Admin
                          </span>
                        )}
                      </div>
                      {member.is_fictional ? (
                        <div className="text-sm text-amber-600 font-medium">Not registered</div>
                      ) : (
                        <div className="text-sm text-gray-500">Active member</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">{trip.base_currency} 0.00</div>
                    <div className="text-xs text-gray-500">Balance</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
              <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600 text-sm mb-4">No members yet</p>
              <button className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors">
                Add First Member
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-6 pb-24">
          <div className="grid grid-cols-2 gap-4">
            <button className="bg-white border-2 border-primary-600 text-primary-600 rounded-2xl p-4 font-semibold hover:bg-primary-50 transition-colors shadow-sm">
              Add Expense
            </button>
            <button className="bg-white border-2 border-gray-300 text-gray-700 rounded-2xl p-4 font-semibold hover:bg-gray-50 transition-colors shadow-sm">
              View Balances
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
