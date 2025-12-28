/**
 * Join Trip Page
 * Decodes invite link, shows trip preview, and allows user to confirm joining
 */
import { format } from 'date-fns';
import { AlertCircle, Calendar, CheckCircle2, DollarSign, Loader2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { formatDateRange } from '../utils/dateUtils';

// Invite info returned from decode API
interface InviteInfo {
  code: string;
  trip_id: number;
  trip_name: string;
  trip_description: string | null;
  base_currency: string;
  start_date: string | null;
  end_date: string | null;
  member_count: number;
  is_already_member: boolean;
}

type JoinStatus =
  | 'loading'
  | 'ready_to_join'
  | 'joining'
  | 'success'
  | 'already_member'
  | 'invalid_code'
  | 'not_found'
  | 'expired'
  | 'error';

export default function JoinTrip() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<JoinStatus>('loading');
  const [error, setError] = useState<string>('');
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!user) {
      const currentUrl = window.location.pathname;
      navigate(`/auth/login?redirect=${encodeURIComponent(currentUrl)}`);
      return;
    }

    if (!code) {
      setStatus('invalid_code');
      setError('No invite code provided');
      return;
    }

    decodeInviteLink();
  }, [code, user, navigate]);

  const decodeInviteLink = async () => {
    if (!code) return;

    setStatus('loading');

    try {
      const response = await api.invites.decode(code);
      const info: InviteInfo = response.data;
      setInviteInfo(info);

      if (info.is_already_member) {
        setStatus('already_member');
      } else {
        setStatus('ready_to_join');
      }
    } catch (err: any) {
      console.error('Decode invite error:', err);

      if (err.response?.status === 400) {
        setStatus('invalid_code');
        setError('Invalid invite code format');
      } else if (err.response?.status === 404) {
        setStatus('not_found');
        setError('This invite link is invalid or no longer exists');
      } else if (err.response?.status === 410) {
        setStatus('expired');
        setError('This invite link has expired');
      } else {
        setStatus('error');
        setError(err.response?.data?.detail || 'Failed to load invite details');
      }
    }
  };

  const handleConfirmJoin = async () => {
    if (!code || isJoining) return;

    setIsJoining(true);
    setStatus('joining');

    try {
      await api.invites.join(code);

      const response = await api.invites.decode(code);
      setInviteInfo(response.data);

      setStatus('success');

      setTimeout(() => {
        if (inviteInfo) {
          navigate(`/trips/${inviteInfo.trip_id}`);
        }
      }, 2000);
    } catch (err: any) {
      console.error('Join trip error:', err);
      setIsJoining(false);

      if (err.response?.status === 404) {
        setStatus('not_found');
        setError('This invite link is invalid or no longer exists');
      } else if (err.response?.status === 410) {
        setStatus('expired');
        setError('This invite link has expired');
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
    if (inviteInfo) {
      navigate(`/trips/${inviteInfo.trip_id}`);
    }
  };

  // Loading state
  if (!user || status === 'loading' || status === 'joining') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {status === 'loading' && 'Loading Invite...'}
              {status === 'joining' && 'Joining Trip...'}
            </h2>
            <p className="text-gray-600">
              {status === 'loading' && 'Getting trip details...'}
              {status === 'joining' && 'Adding you to the trip...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          {/* Ready to Join - Confirmation Screen */}
          {status === 'ready_to_join' && inviteInfo && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">You're Invited!</h2>
              <p className="text-gray-600 mb-4">
                You've been invited to join:
              </p>

              {/* Trip Preview */}
              <div className="p-4 bg-gray-50 rounded-lg mb-6 text-left">
                <h3 className="font-semibold text-gray-900 mb-3">{inviteInfo.trip_name}</h3>
                {inviteInfo.trip_description && (
                  <p className="text-sm text-gray-600 mb-3">{inviteInfo.trip_description}</p>
                )}
                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {inviteInfo.base_currency}
                  </span>
                  {(inviteInfo.start_date || inviteInfo.end_date) && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDateRange(inviteInfo.start_date ?? undefined, inviteInfo.end_date ?? undefined, format)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {inviteInfo.member_count} {inviteInfo.member_count === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </div>

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
          {status === 'already_member' && inviteInfo && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Already a Member!</h2>
              <p className="text-gray-600 mb-4">
                You're already a member of <strong>{inviteInfo.trip_name}</strong>
              </p>

              {/* Trip Preview */}
              <div className="p-4 bg-gray-50 rounded-lg mb-6 text-left">
                <h3 className="font-semibold text-gray-900 mb-3">{inviteInfo.trip_name}</h3>
                {inviteInfo.trip_description && (
                  <p className="text-sm text-gray-600 mb-3">{inviteInfo.trip_description}</p>
                )}
                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {inviteInfo.base_currency}
                  </span>
                  {(inviteInfo.start_date || inviteInfo.end_date) && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDateRange(inviteInfo.start_date ?? undefined, inviteInfo.end_date ?? undefined, format)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {inviteInfo.member_count} {inviteInfo.member_count === 1 ? 'member' : 'members'}
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
          {status === 'success' && inviteInfo && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to {inviteInfo.trip_name}! 🎉</h2>
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

          {/* Invalid Code State */}
          {status === 'invalid_code' && (
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

          {/* Not Found State */}
          {status === 'not_found' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Invite Not Found</h2>
              <p className="text-gray-600 mb-6">
                {error || 'This invite link is invalid or no longer exists.'}
              </p>
              <button
                onClick={handleGoHome}
                className="w-full px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
              >
                Go to My Trips
              </button>
            </div>
          )}

          {/* Expired State */}
          {status === 'expired' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Invite Expired</h2>
              <p className="text-gray-600 mb-6">
                This invite link has expired. Please request a new invite from the trip admin.
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
                    setStatus('loading');
                    setError('');
                    decodeInviteLink();
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
