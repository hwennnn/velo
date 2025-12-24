/**
 * Shimmer Loading Effect Component
 * Reusable shimmer animation for loading states
 */
import React from 'react';

interface ShimmerProps {
  className?: string;
}

export const Shimmer: React.FC<ShimmerProps> = ({ className = '' }) => {
  return (
    <div className={`relative overflow-hidden bg-gray-200 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200"></div>
    </div>
  );
};

// Add shimmer animation to tailwind config if not already present
// @keyframes shimmer {
//   100% { transform: translateX(100%); }
// }

