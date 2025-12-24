/**
 * Member Utility Functions
 * Helper functions for member-related operations
 */

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
 * Get initials from member nickname
 */
export const getMemberInitials = (nickname: string): string => {
  return nickname
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

