/**
 * Trip Header Component
 * Header with back button, trip name, and settings
 */
import { ArrowLeft, Settings } from 'lucide-react';
import React from 'react';

interface TripHeaderProps {
  tripName: string;
  isLoading?: boolean;
  onBack: () => void;
  onSettings: () => void;
}

export const TripHeader: React.FC<TripHeaderProps> = ({
  tripName,
  isLoading = false,
  onBack,
  onSettings,
}) => {
  return (
    <header className="bg-white px-4 py-3 border-b border-gray-200 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          aria-label="Back to trips"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">{tripName}</h1>
          {/* Subtle loading indicator when refetching */}
          {isLoading && (
            <div className="h-0.5 w-full bg-gray-200 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-primary-600 rounded-full animate-pulse" style={{ width: '40%' }}></div>
            </div>
          )}
        </div>
        <button
          onClick={onSettings}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          aria-label="Trip settings"
        >
          <Settings className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </header>
  );
};

