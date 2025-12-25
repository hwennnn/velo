/**
 * Members Modal Component
 * Displays list of trip members with actions
 */
import { Link2, Plus, Users, X } from 'lucide-react';
import React from 'react';
import type { TripMember } from '../types';
import { MemberListItem } from './MemberListItem';

interface MembersModalProps {
  isOpen: boolean;
  members: TripMember[];
  currentUserId?: string;
  isCurrentUserAdmin: boolean;
  memberMenuOpen: number | null;
  onClose: () => void;
  onMemberClick: (member: TripMember) => void;
  onMenuToggle: (memberId: number) => void;
  onClaimMember: (memberId: number, memberName: string) => void;
  onPromoteToAdmin: (memberId: number, memberName: string) => void;
  onDemoteAdmin: (memberId: number, memberName: string) => void;
  onRemoveMember: (memberId: number, memberName: string) => void;
  onLeaveTrip: () => void;
  onInvite: () => void;
  onAddMember: () => void;
}

export const MembersModal: React.FC<MembersModalProps> = ({
  isOpen,
  members,
  currentUserId,
  isCurrentUserAdmin,
  memberMenuOpen,
  onClose,
  onMemberClick,
  onMenuToggle,
  onClaimMember,
  onPromoteToAdmin,
  onDemoteAdmin,
  onRemoveMember,
  onLeaveTrip,
  onInvite,
  onAddMember,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl animate-slideUp sm:animate-fadeIn max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Trip Members</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {members && members.length > 0 ? (
            <div className="space-y-2">
              {members.map((member, index) => (
                <MemberListItem
                  key={member.id}
                  member={member}
                  currentUserId={currentUserId}
                  isCurrentUserAdmin={isCurrentUserAdmin}
                  isMenuOpen={memberMenuOpen === member.id}
                  onMemberClick={() => onMemberClick(member)}
                  onMenuToggle={() => onMenuToggle(member.id)}
                  onClaimMember={() => onClaimMember(member.id, member.nickname)}
                  onPromoteToAdmin={() => onPromoteToAdmin(member.id, member.nickname)}
                  onDemoteAdmin={() => onDemoteAdmin(member.id, member.nickname)}
                  onRemoveMember={() => onRemoveMember(member.id, member.nickname)}
                  onLeaveTrip={onLeaveTrip}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">No members yet</p>
            </div>
          )}
        </div>

        {isCurrentUserAdmin && (
          <div className="p-4 border-t border-gray-200 flex gap-2">
            <button 
              onClick={onInvite}
              className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Link2 className="w-4 h-4" />
              Invite
            </button>
            <button 
              onClick={onAddMember}
              className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Member
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

