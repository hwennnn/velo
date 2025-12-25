/**
 * Trip Detail Skeleton Component
 * Full page skeleton for initial trip detail load
 */
import React from 'react';
import { Shimmer } from './Shimmer';

export const TripDetailSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      {/* Header Skeleton */}
      <header className="bg-white px-5 py-4 safe-top shadow-sm border-b border-gray-100">
        <div className="flex items-center justify-between mt-4">
          <Shimmer className="w-9 h-9 rounded-lg" />
          <div className="flex-1 text-center px-4">
            <Shimmer className="h-6 rounded w-32 mx-auto mb-1" />
            <Shimmer className="h-3 rounded w-24 mx-auto" />
          </div>
          <Shimmer className="w-9 h-9 rounded-lg" />
        </div>
      </header>

      {/* Content Skeleton */}
      <main className="flex-1 overflow-y-auto pb-24">
        {/* Total Spent Card Skeleton */}
        <div className="px-5 pt-4 pb-3">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            {/* Header with member avatars */}
            <div className="flex items-center justify-between mb-4">
              <Shimmer className="h-4 rounded w-24" />
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <Shimmer key={i} className="w-8 h-8 rounded-full border-2 border-white" />
                ))}
              </div>
            </div>

            {/* Total Amount */}
            <div className="mb-4">
              <Shimmer className="h-10 rounded w-48 mb-2" />
            </div>

            {/* Balance Indicator */}
            <div className="rounded-xl p-3 bg-gray-50">
              <Shimmer className="h-4 rounded w-64" />
            </div>
          </div>
        </div>

        {/* Action Buttons Skeleton */}
        <div className="px-5 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <Shimmer className="rounded-xl h-12" />
            <Shimmer className="rounded-xl h-12" />
          </div>
        </div>

        {/* Recent Activity Skeleton */}
        <div className="relative">
          {/* Sticky Header Skeleton */}
          <div className="sticky top-0 z-10 bg-gray-50 px-5 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <Shimmer className="h-7 rounded w-32" />
              <Shimmer className="h-8 rounded-lg w-16" />
            </div>
          </div>

          {/* Content Skeleton */}
          <div className="px-5 pt-3 space-y-4">
            {[1, 2].map((groupIndex) => (
              <div key={groupIndex} className="space-y-2">
                {/* Date Header Skeleton */}
                <div className="px-1">
                  <Shimmer className="h-3 rounded w-24" />
                </div>

                {/* Expense Items Skeleton */}
                <div className="space-y-2">
                  {[1, 2].map((itemIndex) => (
                    <div key={itemIndex} className="bg-white rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        {/* Icon Skeleton */}
                        <Shimmer className="w-10 h-10 rounded-full flex-shrink-0" />

                        {/* Content Skeleton */}
                        <div className="flex-1 min-w-0">
                          <Shimmer className="h-4 rounded w-3/4 mb-2" />
                          <Shimmer className="h-3 rounded w-1/2" />
                        </div>

                        {/* Amount Skeleton */}
                        <div className="text-right flex-shrink-0">
                          <Shimmer className="h-4 rounded w-16 mb-1" />
                          <Shimmer className="h-3 rounded w-10" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* FAB Skeleton */}
      <Shimmer className="absolute bottom-6 right-6 w-16 h-16 rounded-full z-50" />
    </div>
  );
};

