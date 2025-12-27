/**
 * Join Trip Page
 * Validates invite link, shows trip preview, and allows user to confirm joining
 */
import { format } from 'date-fns';
import { AlertCircle, Calendar, CheckCircle2, DollarSign, Loader2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import type { Trip } from '../types';
import { formatDateRange } from '../utils/dateUtils';

type JoinStatus =
  | 'validating'       // Validating link format
  | 'loading_trip'     // Loading trip details
  | 'ready_to_join'    // Showing confirmation screen
  | 'joining'          // Adding user to trip
  | 'success'          // Successfully joined
  | 'invalid_link'     // Link format is invalid
  | 'trip_not_found'   // Trip doesn't exist
  | 'already_member'   // User is already a member
  | 'error';           // Other errors

export default function JoinTrip() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<JoinStatus>('validating');
  const [error, setError] = useState<string>('');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const tripId = searchParams.get('trip');
  const inviteCode = searchParams.get('code');

  useEffect(() => {
    if (!user) {
      // Redirect to login with return URL
      const currentUrl = window.location.pathname + window.location.search;
      navigate(`/auth/login?redirect=${encodeURIComponent(currentUrl)}`);
      return;
    }

    validateInviteLink();
  }, [tripId, user, navigate]);

  const validateInviteLink = async () => {
    // Validate required parameters
    if (!tripId) {
      setStatus('invalid_link');
      setError('Missing trip ID in invite link');
      return;
    }

    if (!inviteCode) {
      setStatus('invalid_link');
      setError('Missing invite code in link');
      return;
    }

    // Validate trip ID is a number
    const tripIdNum = parseInt(tripId);
    if (isNaN(tripIdNum) || tripIdNum <= 0) {
      setStatus('invalid_link');
      setError('Invalid trip ID format');
      return;
    }

    // Validate invite code format (should be 16 chars hex)
    if (!/^[a-f0-9]{16}$/i.test(inviteCode)) {
      setStatus('invalid_link');
      setError('Invalid invite code format');
      return;
    }

    // Link format is valid, now load trip details
    await loadTripDetails();
  };

  const loadTripDetails = async () => {
    setStatus('loading_trip');

    try {
      // Try to get trip details
      const response = await api.trips.getById(tripId!);
      setTrip(response.data);

      // If we can access the trip, user might already be a member
      setStatus('already_member');
    } catch (err: any) {
      if (err.response?.status === 404) {
        setStatus('trip_not_found');
        setError('This trip does not exist or has been deleted');
      } else if (err.response?.status === 403) {
        // User is not a member yet - this is expected!
        // We can't show trip details, so just show generic confirmation
        setStatus('ready_to_join');
      } else {
        setStatus('error');
        setError(err.response?.data?.detail || 'Failed to load trip details');
      }
    }
  };

  const handleConfirmJoin = async () => {
    if (!tripId || isJoining) return;

    setIsJoining(true);
    setStatus('joining');

    try {
      // Join the trip
      await api.trips.joinViaInvite(tripId);

      // Load trip details now that we're a member
      const tripResponse = await api.trips.getById(tripId);
      setTrip(tripResponse.data);

      setStatus('success');

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate(`/trips/${tripId}`);
      }, 2000);
    } catch (err: any) {
      console.error('Join trip error:', err);
      setIsJoining(false);

      if (err.response?.status === 404) {
        setStatus('trip_not_found');
        setError('This trip does not exist or has been deleted');
      } else if (err.response?.status === 403) {
        setStatus('error');
        setError('You do not have permission to join this trip');
      } else {
        setStatus('error');
        setError(err.response?.data?.detail || 'Failed to join trip. Please try again.');
      }
    }
  };

  const handleGoHome = () => {
    navigate('/trips');
  };

  const handleGoToTrip = () => {
    if (tripId) {
      navigate(`/trips/${tripId}`);
    }
  };

  // Loading state
  if (!user || status === 'validating' || status === 'loading_trip' || status === 'joining') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {status === 'validating' && 'Validating Invite...'}
              {status === 'loading_trip' && 'Loading Trip Details...'}
              {status === 'joining' && 'Joining Trip...'}
            </h2>
            <p className="text-gray-600">
              {status === 'validating' && 'Checking invite link validity...'}
              {status === 'loading_trip' && 'Fetching trip information...'}
              {status === 'joining' && 'Adding you to the trip...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Ready to Join - Confirmation Screen */}
          {status === 'ready_to_join' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">You're Invited!</h2>
              <p className="text-gray-600 mb-6">
                You've been invited to join a trip. Click the button below to join and start tracking expenses together.
              </p>

              <button
                onClick={handleConfirmJoin}
                disabled={isJoining}
                className="w-full px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
              >
                {isJoining ? 'Joining...' : 'Yes, Join This Trip'}
              </button>

              <button
                onClick={handleGoHome}
                className="w-full px-6 py-3 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                No Thanks, Go Back
              </button>
            </div>
          )}

          {/* Already Member */}
          {status === 'already_member' && trip && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Already a Member!</h2>
              <p className="text-gray-600 mb-4">
                You're already a member of <strong>{trip.name}</strong>
              </p>

              {/* Trip Preview */}
              <div className="p-4 bg-gray-50 rounded-lg mb-6 text-left">
                <h3 className="font-semibold text-gray-900 mb-3">{trip.name}</h3>
                {trip.description && (
                  <p className="text-sm text-gray-600 mb-3">{trip.description}</p>
                )}
                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {trip.base_currency}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDateRange(trip.start_date, trip.end_date, format)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {trip.member_count} members
                  </span>
                </div>
              </div>

              <button
                onClick={handleGoToTrip}
                className="w-full px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors mb-3"
              >
                Go to Trip
              </button>

              <button
                onClick={handleGoHome}
                className="w-full px-6 py-3 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Go to My Trips
              </button>
            </div>
          )}

          {/* Success State */}
          {status === 'success' && trip && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to {trip.name}! 🎉</h2>
              <p className="text-gray-600 mb-6">
                You've been successfully added to the trip. Redirecting you now...
              </p>
              <button
                onClick={handleGoToTrip}
                className="w-full px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
              >
                Go to Trip Now
              </button>
            </div>
          )}

          {/* Invalid Link State */}
          {status === 'invalid_link' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Invite Link</h2>
              <p className="text-gray-600 mb-2">{error}</p>
              <p className="text-sm text-gray-500 mb-6">
                Please check the link and try again, or request a new invite from the trip admin.
              </p>
              <button
                onClick={handleGoHome}
                className="w-full px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
              >
                Go to My Trips
              </button>
            </div>
          )}

          {/* Trip Not Found State */}
          {status === 'trip_not_found' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Trip Not Found</h2>
              <p className="text-gray-600 mb-6">
                This trip may have been deleted or the invite link is no longer valid.
              </p>
              <button
                onClick={handleGoHome}
                className="w-full px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
              >
                Go to My Trips
              </button>
            </div>
          )}

          {/* Generic Error State */}
          {status === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Join Trip</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setStatus('validating');
                    setError('');
                    validateInviteLink();
                  }}
                  className="w-full px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={handleGoHome}
                  className="w-full px-6 py-3 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Go to My Trips
                </button>
              </div>
            </div>
          )}
        </div>


      </div>
    </div>
  );
}
