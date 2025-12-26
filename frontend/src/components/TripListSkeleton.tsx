/**
 * Trip List Skeleton
 * Shimmer placeholders for the Home (Trips) list while loading
 */
import React from 'react';
import { Shimmer } from './Shimmer';

export const TripListSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="w-full bg-white rounded-xl p-5 shadow-sm"
        >
          {/* Title + currency pill */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 pr-3">
              <Shimmer className="h-5 rounded w-40 mb-2" />
              <Shimmer className="h-3 rounded w-28" />
            </div>
            <Shimmer className="h-6 rounded-lg w-14" />
          </div>

          {/* Members + total spent */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((a) => (
                  <Shimmer key={a} className="w-8 h-8 rounded-full border-2 border-white" />
                ))}
              </div>
            </div>
            <div className="text-right">
              <Shimmer className="h-3 rounded w-20 mb-1" />
              <Shimmer className="h-7 rounded w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};


