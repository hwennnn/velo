/**
 * Avatar Component
 * Displays member avatars with fallback to initials
 */
import React, { useState } from 'react';
import type { TripMember } from '../types';
import { getMemberInitials } from '../utils/memberUtils';

interface AvatarProps {
  member: Pick<TripMember, 'id' | 'display_name' | 'avatar_url' | 'nickname'>;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm', 
  lg: 'w-16 h-16 text-lg',
  xl: 'w-20 h-20 text-2xl'
};

const getMemberColor = (id: number) => {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-violet-500', 
    'bg-pink-500',
    'bg-amber-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-cyan-500',
    'bg-lime-500',
    'bg-orange-500',
  ];
  return colors[id % colors.length];
};

export const Avatar: React.FC<AvatarProps> = ({ 
  member, 
  size = 'md', 
  className = '',
  onClick 
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  
  const sizeClass = sizeClasses[size];
  const colorClass = getMemberColor(member.id);
  const initials = getMemberInitials(member.display_name || member.nickname);
  
  const hasAvatar = member.avatar_url !== null && member.avatar_url !== undefined && member.avatar_url.length > 0 && !imageError;
  
  const handleImageLoad = () => {
    setImageLoading(false);
  };
  
  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };
  
  const baseClasses = `
    ${sizeClass} 
    rounded-full 
    flex 
    items-center 
    justify-center 
    font-semibold 
    text-white 
    relative
    overflow-hidden
    ${onClick ? 'cursor-pointer' : ''}
    ${className}
  `.trim();
  
  return (
    <div 
      className={`${baseClasses} ${hasAvatar ? 'bg-gray-200' : colorClass}`}
      onClick={onClick}
    >
      {hasAvatar ? (
        <>
          {imageLoading && (
            <div className={`absolute inset-0 ${colorClass} flex items-center justify-center`}>
              <span className="animate-pulse">{initials}</span>
            </div>
          )}
          <img
            src={member.avatar_url}
            alt={`${member.nickname}'s avatar`}
            className="w-full h-full object-cover"
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{ display: imageLoading ? 'none' : 'block' }}
          />
        </>
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};
