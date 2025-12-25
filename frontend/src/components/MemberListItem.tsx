/**
 * Member List Item Component
 * Displays a single member in the members list with actions menu
 */
import { LogOut, MoreVertical, Shield, Trash2, UserCheck } from 'lucide-react';
import React from 'react';
import type { TripMember } from '../types';

interface MemberListItemProps {
  member: TripMember;
  index: number;
  currentUserId?: string;
  isCurrentUserAdmin: boolean;
  isMenuOpen: boolean;
  getMemberColor: (index: number) => string;
  getMemberInitials: (nickname: string) => string;
  onMemberClick: () => void;
  onMenuToggle: () => void;
  onClaimMember: () => void;
  onPromoteToAdmin: () => void;
  onDemoteAdmin: () => void;
  onRemoveMember: () => void;
  onLeaveTrip: () => void;
}

export const MemberListItem: React.FC<MemberListItemProps> = ({
  member,
  index,
  currentUserId,
  isCurrentUserAdmin,
  isMenuOpen,
  getMemberColor,
  getMemberInitials,
  onMemberClick,
  onMenuToggle,
  onClaimMember,
  onPromoteToAdmin,
  onDemoteAdmin,
  onRemoveMember,
  onLeaveTrip,
}) => {
  const isCurrentUser = member.user_id === currentUserId;
  const hasAvailableActions = member.is_fictional || (isCurrentUserAdmin && !isCurrentUser) || isCurrentUser;

  return (
    <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between hover:bg-gray-100 transition-colors">
      <div 
        className="flex items-center gap-3 flex-1 cursor-pointer"
        onClick={onMemberClick}
      >
        <div
          className={`w-10 h-10 ${getMemberColor(index)} rounded-full flex items-center justify-center text-white font-semibold text-sm`}
        >
          {getMemberInitials(member.nickname)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 flex items-center gap-2 text-sm">
            <span className="truncate">{member.nickname}</span>
            {isCurrentUser && (
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
            <div className="text-xs text-amber-600 font-medium">Fictional member</div>
          ) : (
            <div className="text-xs text-gray-500 space-y-0.5">
              {member.display_name && member.display_name !== member.nickname && (
                <div className="truncate">{member.display_name}</div>
              )}
              {member.email && (
                <div className="truncate">{member.email}</div>
              )}
              {!member.email && !member.display_name && (
                <div>Active member</div>
              )}
            </div>
          )}
        </div>
      </div>

      {hasAvailableActions && (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle();
            }}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-gray-600" />
          </button>

          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={onMenuToggle}
              />
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                {member.is_fictional && (
                  <button
                    onClick={onClaimMember}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <UserCheck className="w-4 h-4" />
                    Claim Member
                  </button>
                )}

                {isCurrentUserAdmin && !isCurrentUser && !member.is_fictional && (
                  <>
                    {!member.is_admin ? (
                      <button
                        onClick={onPromoteToAdmin}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <Shield className="w-4 h-4" />
                        Promote to Admin
                      </button>
                    ) : (
                      <button
                        onClick={onDemoteAdmin}
                        className="w-full px-4 py-2 text-left text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2"
                      >
                        <Shield className="w-4 h-4" />
                        Remove Admin
                      </button>
                    )}
                  </>
                )}

                {isCurrentUserAdmin && !isCurrentUser && (
                  <button
                    onClick={onRemoveMember}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove Member
                  </button>
                )}

                {isCurrentUser && (
                  <button
                    onClick={onLeaveTrip}
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
  );
};

