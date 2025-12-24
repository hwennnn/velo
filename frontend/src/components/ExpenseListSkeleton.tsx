/**
 * Expense List Skeleton Component
 * Loading skeleton for expense list with shimmer effect
 */
import React from 'react';
import { Shimmer } from './Shimmer';

export const ExpenseListSkeleton: React.FC = () => {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <Shimmer className="h-4 rounded w-3/4 mb-2" />
              <Shimmer className="h-3 rounded w-1/2" />
            </div>
            <Shimmer className="h-6 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
};

