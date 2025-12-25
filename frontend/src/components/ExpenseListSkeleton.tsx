/**
 * Expense List Skeleton Component
 * Loading skeleton for expense list with shimmer effect
 */
import React from 'react';
import { Shimmer } from './Shimmer';

export const ExpenseListSkeleton: React.FC = () => {
  return (
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
        {[1, 2, 3].map((groupIndex) => (
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
  );
};

