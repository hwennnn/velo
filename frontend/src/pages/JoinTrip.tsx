/**
 * Join Trip Page
 * Decodes invite link, shows trip preview, and allows user to confirm joining
 * Supports claiming placeholder/pending members via selection or personalized link
 */
import { format } from 'date-fns';
import { AlertCircle, Calendar, CheckCircle2, DollarSign, Loader2, User, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDecodeInvite, useJoinTrip, type ClaimableMember } from '../hooks/useInvites';
import { formatDateRange } from '../utils/dateUtils';

export default function JoinTrip() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const claimParam = searchParams.get('claim');
  const claimMemberFromUrl = claimParam ? parseInt(claimParam, 10) : undefined;

  const navigate = useNavigate();
  const { user } = useAuth();
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [selectedClaimMember, setSelectedClaimMember] = useState<number | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!code) return;

    if (!user) {
      // Preserve the claim parameter in redirect
      const redirectUrl = claimParam ? `/join/${code}?claim=${claimParam}` : `/join/${code}`;
      navigate(`/auth/login?redirect=${encodeURIComponent(redirectUrl)}`);
    }
  }, [code, user, navigate, claimParam]);

  // Fetch invite info using React Query (pass claim param for validation)
  const {
    data: inviteInfo,
    isLoading,
    error: decodeError,
  } = useDecodeInvite(user ? code : undefined, claimMemberFromUrl);

  // Determine which member ID to use (priority: personalized invite > user selection)
  const claimMemberIdToUse = inviteInfo?.claim_member_id ?? selectedClaimMember;

  // Join trip mutation
  const joinTripMutation = useJoinTrip();

  const handleConfirmJoin = async () => {
    if (!code) return;

    try {
      await joinTripMutation.mutateAsync({
        code,
        claimMemberId: claimMemberIdToUse ?? undefined
      });
      setJoinSuccess(true);

      // Redirect after success
      setTimeout(() => {
        if (inviteInfo) {
          navigate(`/trips/${inviteInfo.trip_id}`);
        }
      }, 2000);
    } catch {
      // Error is handled by mutation state
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

  const handleRetry = () => {
    // Trigger refetch by navigating to the same route
    window.location.reload();
  };

  // Get the member being claimed (if any)
  const getClaimingMember = (): ClaimableMember | undefined => {
    if (!claimMemberIdToUse || !inviteInfo?.claimable_members) return undefined;
    return inviteInfo.claimable_members.find(m => m.id === claimMemberIdToUse);
  };

  // Determine error type from decodeError
  const getErrorType = () => {
    if (!decodeError) return null;

    const axiosError = decodeError as { response?: { status?: number; data?: { detail?: string } } };
    const status = axiosError.response?.status;

    if (!code) return 'invalid_code';
    if (status === 400) return 'invalid_code';
    if (status === 404) return 'not_found';
    if (status === 410) return 'expired';
    return 'error';
  };

  const getErrorMessage = () => {
    if (!decodeError) return '';

    const axiosError = decodeError as { response?: { status?: number; data?: { detail?: string } } };
    const errorType = getErrorType();

    if (!code) return 'No invite code provided';
    if (errorType === 'invalid_code') return 'Invalid invite code format';
    if (errorType === 'not_found') return 'This invite link is invalid or no longer exists';
    if (errorType === 'expired') return 'This invite link has expired';
    return axiosError.response?.data?.detail || 'Failed to load invite details';
  };

  const joinError = joinTripMutation.error as { response?: { status?: number; data?: { detail?: string } } };
  const getJoinErrorType = () => {
    if (!joinError) return null;
    const status = joinError.response?.status;
    if (status === 404) return 'not_found';
    if (status === 410) return 'expired';
    return 'error';
  };

  const getJoinErrorMessage = () => {
    if (!joinError) return '';
    const errorType = getJoinErrorType();
    if (errorType === 'not_found') return 'This invite link is invalid or no longer exists';
    if (errorType === 'expired') return 'This invite link has expired';
    return joinError.response?.data?.detail || 'Failed to join trip. Please try again.';
  };

  // Loading state
  if (!user || isLoading || joinTripMutation.isPending) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {isLoading && 'Loading Invite...'}
              {joinTripMutation.isPending && 'Joining Trip...'}
            </h2>
            <p className="text-gray-600">
              {isLoading && 'Getting trip details...'}
              {joinTripMutation.isPending && 'Adding you to the trip...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const errorType = getErrorType();
  const errorMessage = getErrorMessage();
  const joinErrorType = getJoinErrorType();
  const joinErrorMessage = getJoinErrorMessage();
  const claimingMember = getClaimingMember();
  const hasClaimableMembers = inviteInfo?.claimable_members && inviteInfo.claimable_members.length > 0;
  const isPersonalizedInvite = !!inviteInfo?.claim_member_id;

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          {/* Success State */}
          {joinSuccess && inviteInfo && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to {inviteInfo.trip_name}! 🎉</h2>
              <p className="text-gray-600 mb-6">
                {claimingMember
                  ? `You've joined as "${claimingMember.nickname}". Redirecting you now...`
                  : "You've been successfully added to the trip. Redirecting you now..."
                }
              </p>
              <button
                onClick={handleGoToTrip}
                className="w-full px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
              >
                Go to Trip Now
              </button>
            </div>
          )}

          {/* Join Error State */}
          {!joinSuccess && joinTripMutation.isError && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {joinErrorType === 'not_found' && 'Invite Not Found'}
                {joinErrorType === 'expired' && 'Invite Expired'}
                {joinErrorType === 'error' && 'Unable to Join Trip'}
              </h2>
              <p className="text-gray-600 mb-6">{joinErrorMessage}</p>
              <div className="space-y-2">
                <button
                  onClick={handleRetry}
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

          {/* Decode Error States */}
          {!joinSuccess && !joinTripMutation.isError && decodeError && (
            <>
              {/* Invalid Code State */}
              {errorType === 'invalid_code' && (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Invite Link</h2>
                  <p className="text-gray-600 mb-2">{errorMessage}</p>
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
              {errorType === 'not_found' && (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-amber-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Invite Not Found</h2>
                  <p className="text-gray-600 mb-6">
                    {errorMessage || 'This invite link is invalid or no longer exists.'}
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
              {errorType === 'expired' && (
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
              {errorType === 'error' && (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Invite</h2>
                  <p className="text-gray-600 mb-6">{errorMessage}</p>
                  <div className="space-y-2">
                    <button
                      onClick={handleRetry}
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
            </>
          )}

          {/* Ready to Join - Confirmation Screen */}
          {!joinSuccess && !decodeError && !joinTripMutation.isError && inviteInfo && !inviteInfo.is_already_member && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">You're Invited!</h2>
              <p className="text-gray-600 mb-4">
                You've been invited to join:
              </p>

              {/* Trip Preview */}
              <div className="p-4 bg-gray-50 rounded-lg mb-4 text-left">
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

              {/* Claim Member Selection - Only show for generic invites with claimable members */}
              {hasClaimableMembers && !isPersonalizedInvite && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-3 text-left">
                    Join as an existing member or create a new one:
                  </p>
                  <div className="space-y-2 text-left">
                    {/* Join as new member option */}
                    <label
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedClaimMember === null
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                      <input
                        type="radio"
                        name="claimMember"
                        checked={selectedClaimMember === null}
                        onChange={() => setSelectedClaimMember(null)}
                        className="w-4 h-4 text-primary-600"
                      />
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                        <UserPlus className="w-4 h-4 text-primary-600" />
                      </div>
                      <span className="font-medium text-gray-900">Join as new member</span>
                    </label>

                    {/* Claimable members */}
                    {inviteInfo.claimable_members.map((member) => (
                      <label
                        key={member.id}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedClaimMember === member.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:bg-gray-50'
                          }`}
                      >
                        <input
                          type="radio"
                          name="claimMember"
                          checked={selectedClaimMember === member.id}
                          onChange={() => setSelectedClaimMember(member.id)}
                          className="w-4 h-4 text-primary-600"
                        />
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">{member.nickname}</span>
                          {member.invited_email && (
                            <span className="block text-xs text-gray-500">{member.invited_email}</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Personalized invite - Auto claiming message */}
              {isPersonalizedInvite && claimingMember && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-left">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">You'll be joining as "{claimingMember.nickname}"</span>
                    {claimingMember.invited_email && (
                      <span className="block text-xs text-blue-600 mt-1">
                        Invited email: {claimingMember.invited_email}
                      </span>
                    )}
                  </p>
                </div>
              )}

              <button
                onClick={handleConfirmJoin}
                disabled={joinTripMutation.isPending}
                className="w-full px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
              >
                {joinTripMutation.isPending
                  ? 'Joining...'
                  : claimMemberIdToUse
                    ? `Join as "${getClaimingMember()?.nickname}"`
                    : 'Join This Trip'
                }
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
          {!joinSuccess && !decodeError && !joinTripMutation.isError && inviteInfo && inviteInfo.is_already_member && (
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
        </div>
      </div>
    </div>
  );
}
