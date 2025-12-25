/**
 * Member Utility Functions
 * Helper functions for member-related operations
 */

import type { TripMember } from '../types';

/**
 * Get color class for member avatar based on index
 */
export const getMemberColor = (index: number): string => {
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

/**
 * Get initials from a member object or name string.
 * Prioritizes display_name, then falls back to nickname.
 * 
 * @param memberOrName - Either a TripMember object or a string (nickname/display_name)
 * @param nickname - Optional nickname to use if first param is a string
 * @returns Up to 2 character initials in uppercase
 */
export const getMemberInitials = (
  memberOrName: TripMember | string,
  nickname?: string
): string => {
  let nameToUse: string | undefined;
  
  // If it's a TripMember object, prioritize display_name then nickname
  if (typeof memberOrName === 'object' && memberOrName !== null) {
    nameToUse = memberOrName.display_name || memberOrName.nickname;
  } else {
    // If it's a string, use it (or the provided nickname)
    nameToUse = memberOrName || nickname;
  }
  
  if (!nameToUse) return '?';
  
  const words = nameToUse.trim().split(/\s+/).filter(word => word.length > 0);
  if (!words.length) return '?';
  
  // For single word: return first letter only
  if (words.length === 1) {
    const firstChar = words[0][0];
    if (firstChar && /[a-zA-Z]/.test(firstChar)) {
      return firstChar.toUpperCase();
    }
    // Fallback: find first alphabetic character
    for (const char of words[0]) {
      if (/[a-zA-Z]/.test(char)) {
        return char.toUpperCase();
      }
    }
    return '?';
  }
  
  // For multiple words: return first letter of first two words
  let initials = '';
  for (let i = 0; i < Math.min(words.length, 2); i++) {
    const word = words[i];
    if (word && word[0] && /[a-zA-Z]/.test(word[0])) {
      initials += word[0].toUpperCase();
    }
  }
  
  // If no initials found, try to find any alphabetic character
  if (initials.length === 0) {
    for (const char of nameToUse) {
      if (/[a-zA-Z]/.test(char)) {
        return char.toUpperCase();
      }
    }
    return '?';
  }
  
  return initials;
};

