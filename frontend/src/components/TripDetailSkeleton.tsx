/**
 * Trip Detail Skeleton Component
 * Full page skeleton for initial trip detail load
 */
import React from 'react';
import { Shimmer } from './Shimmer';

export const TripDetailSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header Skeleton */}
      <header className="bg-white px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Shimmer className="w-9 h-9 rounded-xl" />
          <div className="flex-1">
            <Shimmer className="h-5 rounded w-32" />
          </div>
          <Shimmer className="w-9 h-9 rounded-xl" />
        </div>
      </header>

      {/* Content Skeleton */}
      <main className="flex-1 p-4 space-y-4">
        <div className="bg-gradient-to-br from-primary-500 to-primary-700 p-4 rounded-xl h-32">
          <Shimmer className="h-4 rounded w-24 mb-3 bg-white/20" />
          <Shimmer className="h-12 rounded-xl w-full bg-white/20" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Shimmer className="rounded-xl h-20" />
          <Shimmer className="rounded-xl h-20" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="flex-1 rounded-xl h-12" />
          <Shimmer className="flex-1 rounded-xl h-12" />
        </div>
        <Shimmer className="rounded-xl h-64" />
      </main>
    </div>
  );
};

