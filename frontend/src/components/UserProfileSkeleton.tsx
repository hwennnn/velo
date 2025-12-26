/**
 * User Profile Skeleton
 * Shimmer placeholders for the Profile tab while loading user data
 */
import React from 'react';
import { Shimmer } from './Shimmer';

export const UserProfileSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Profile Card Skeleton */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col items-center mb-6">
          <Shimmer className="w-24 h-24 rounded-full mb-4" />
          <Shimmer className="h-6 rounded w-40 mb-2" />
          <Shimmer className="h-4 rounded w-52" />
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <Shimmer className="h-4 rounded w-28 mb-2" />
              <Shimmer className="h-10 rounded-lg w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Account Actions Skeleton */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <Shimmer className="h-5 rounded w-24 mb-4" />
        <Shimmer className="h-12 rounded-lg w-full" />
      </div>

      {/* Legal Links Skeleton */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <Shimmer className="h-5 rounded w-20 mb-4" />
        <div className="space-y-3">
          <Shimmer className="h-4 rounded w-32" />
          <Shimmer className="h-4 rounded w-36" />
        </div>
      </div>
    </div>
  );
};


