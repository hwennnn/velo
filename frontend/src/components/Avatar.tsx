/**
 * Avatar Component
 * Displays member avatars with fallback to initials
 */
import React, { useState } from 'react';
import type { TripMember } from '../types';

interface AvatarProps {
  member: TripMember;
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

const getMemberInitials = (nickname: string) => {
  if (!nickname) return '?';
  
  const words = nickname.trim().split(' ');
  if (!words.length) return '?';
  
  let initials = '';
  for (const word of words) {
    if (word && word[0] && /[a-zA-Z]/.test(word[0])) {
      initials += word[0].toUpperCase();
      if (initials.length >= 2) break;
    }
  }
  
  if (initials.length === 0) {
    for (const char of nickname) {
      if (/[a-zA-Z]/.test(char)) {
        initials = char.toUpperCase();
        break;
      }
    }
    if (!initials) initials = '?';
  }
  
  return initials.slice(0, 2);
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
  const initials = getMemberInitials(member.nickname);
  
  const hasAvatar = member.avatar_url && !imageError;
  
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
