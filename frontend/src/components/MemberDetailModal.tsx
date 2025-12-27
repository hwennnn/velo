/**
 * MemberDetailModal Component
 * Shows detailed information about a trip member
 */
import { format } from 'date-fns';
import { Calendar, Mail, Shield, User, UserCheck, X } from 'lucide-react';
import type { TripMember } from '../types';
import { parseUTCDate } from '../utils/dateUtils';
import { Avatar } from './Avatar';

interface MemberDetailModalProps {
  isOpen: boolean;
  member: TripMember | null;
  isCurrentUser: boolean;
  onClose: () => void;
}

export const MemberDetailModal: React.FC<MemberDetailModalProps> = ({
  isOpen,
  member,
  isCurrentUser,
  onClose,
}) => {
  if (!isOpen || !member) return null;


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl animate-slideUp">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Member Details</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Avatar and Name */}
          <div className="flex flex-col items-center mb-6">
            <div className="mb-3">
              <Avatar member={member} size="xl" />
            </div>
            <h4 className="text-xl font-bold text-gray-900 mb-1">{member.nickname}</h4>
            {member.display_name && member.display_name !== member.nickname && (
              <div className="text-sm text-gray-600 mb-2">
                {member.display_name}
              </div>
            )}
            {isCurrentUser && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full mb-2">
                This is you
              </span>
            )}
            <div className="flex gap-2">
              {member.is_admin && (
                <span className="px-3 py-1 bg-primary-100 text-primary-700 text-sm font-medium rounded-full flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Admin
                </span>
              )}
              {member.is_fictional && (
                <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm font-medium rounded-full">
                  Fictional
                </span>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4">
            {/* Real User Info (for claimed members) */}
            {!member.is_fictional && member.display_name && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700 mb-1">Real Name</div>
                    <div className="text-sm text-gray-900">{member.display_name}</div>
                    {member.display_name !== member.nickname && (
                      <div className="text-xs text-gray-500 mt-1">
                        Displayed as: {member.nickname}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Email */}
            {member.email && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700 mb-1">Email</div>
                    <div className="text-sm text-gray-900 break-all">{member.email}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Member Type */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-3">
                <UserCheck className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-700 mb-1">Member Type</div>
                  <div className="text-sm text-gray-900">
                    {member.is_fictional ? (
                      <>
                        Fictional member
                        <div className="text-xs text-gray-500 mt-1">
                          Can be claimed by any user to join the trip
                        </div>
                      </>
                    ) : (
                      <>
                        Active member
                        <div className="text-xs text-gray-500 mt-1">
                          Linked to a user account
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Role */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-700 mb-1">Role</div>
                  <div className="text-sm text-gray-900">
                    {member.is_admin ? (
                      <>
                        Administrator
                        <div className="text-xs text-gray-500 mt-1">
                          Can manage members, expenses, and trip settings
                        </div>
                      </>
                    ) : (
                      <>
                        Member
                        <div className="text-xs text-gray-500 mt-1">
                          Can add expenses and view balances
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Join/Creation Dates */}
            {(member.created_at || member.joined_at) && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    {member.is_fictional ? (
                      <>
                        <div className="text-sm font-medium text-gray-700 mb-1">Created</div>
                        {member.created_at && (
                          <div className="text-sm text-gray-900">
                            {format(parseUTCDate(member.created_at), 'MMMM d, yyyy')}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {member.joined_at ? (
                          <>
                            <div className="text-sm font-medium text-gray-700 mb-1">Joined</div>
                            <div className="text-sm text-gray-900">
                              {format(parseUTCDate(member.joined_at), 'MMMM d, yyyy')}
                            </div>
                            {member.created_at && member.created_at !== member.joined_at && (
                              <div className="text-xs text-gray-500 mt-1">
                                Originally created: {format(parseUTCDate(member.created_at), 'MMMM d, yyyy')}
                              </div>
                            )}
                          </>
                        ) : member.created_at ? (
                          <>
                            <div className="text-sm font-medium text-gray-700 mb-1">Added</div>
                            <div className="text-sm text-gray-900">
                              {format(parseUTCDate(member.created_at), 'MMMM d, yyyy')}
                            </div>
                          </>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full mt-6 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

