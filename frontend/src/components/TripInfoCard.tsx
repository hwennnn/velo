/**
 * Trip Info Card Component
 * Displays trip currency, dates, and members chip
 */
import { Calendar, DollarSign, Users } from 'lucide-react';
import React from 'react';
import type { TripMember } from '../types';

interface TripInfoCardProps {
  currency: string;
  dateRange: string;
  memberCount: number;
  members: TripMember[];
  onMembersClick: () => void;
  getMemberColor: (index: number) => string;
  getMemberInitials: (nickname: string) => string;
}

export const TripInfoCard: React.FC<TripInfoCardProps> = ({
  currency,
  dateRange,
  memberCount,
  members,
  onMembersClick,
  getMemberColor,
  getMemberInitials,
}) => {
  return (
    <div className="bg-gradient-to-br from-primary-500 to-primary-700 p-4 text-white">
      <div className="flex items-center gap-4 text-sm mb-3">
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-4 h-4" />
          <span className="font-medium">{currency}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4" />
          <span className="text-xs">{dateRange}</span>
        </div>
      </div>

      {/* Members Chip - Click to expand */}
      <button
        onClick={onMembersClick}
        className="w-full bg-white/20 backdrop-blur-sm rounded-xl p-3 hover:bg-white/30 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">
              {memberCount} {memberCount === 1 ? 'person' : 'people'}
            </span>
          </div>
          <div className="flex -space-x-2">
            {members.slice(0, 4).map((member, index) => (
              <div
                key={member.id}
                className={`w-7 h-7 ${getMemberColor(index)} rounded-full flex items-center justify-center text-white text-xs font-semibold border-2 border-white`}
              >
                {getMemberInitials(member.nickname)}
              </div>
            ))}
            {memberCount > 4 && (
              <div className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center text-white text-xs font-semibold border-2 border-white">
                +{memberCount - 4}
              </div>
            )}
          </div>
        </div>
      </button>
    </div>
  );
};

