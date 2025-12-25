import { AlertTriangle, Calendar, FileText, LogOut, Settings, Trash2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAlert } from '../contexts/AlertContext';
import { useLeaveTrip } from '../hooks/useMembers';
import { useDeleteTrip, useUpdateTrip } from '../hooks/useTrips';
import type { Trip } from '../types';

interface TripSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onTripUpdated: (trip: Trip) => void;
  onTripLeft: () => void;
  isAdmin: boolean;
}

export function TripSettingsModal({
  isOpen,
  onClose,
  trip,
  onTripUpdated,
  onTripLeft,
  isAdmin,
}: TripSettingsModalProps) {
  const { showAlert } = useAlert();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  
  // React Query mutations
  const updateTripMutation = useUpdateTrip(trip.id.toString());
  const deleteTripMutation = useDeleteTrip();
  const leaveTripMutation = useLeaveTrip(trip.id.toString());
  
  // Combined loading state from all mutations
  const isLoading = updateTripMutation.isPending || deleteTripMutation.isPending || leaveTripMutation.isPending;
  
  // Form state
  const [formData, setFormData] = useState({
    name: trip.name,
    description: trip.description || '',
    start_date: trip.start_date || '',
    end_date: trip.end_date || '',
  });

  // Reset form when trip changes
  useEffect(() => {
    setFormData({
      name: trip.name,
      description: trip.description || '',
      start_date: trip.start_date || '',
      end_date: trip.end_date || '',
    });
  }, [trip]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    
    const updateData: Record<string, unknown> = {};
    
    // Only include changed fields
    if (formData.name !== trip.name) updateData.name = formData.name;
    if (formData.description !== (trip.description || '')) {
      updateData.description = formData.description || null;
    }
    if (formData.start_date !== (trip.start_date || '')) {
      updateData.start_date = formData.start_date || null;
    }
    if (formData.end_date !== (trip.end_date || '')) {
      updateData.end_date = formData.end_date || null;
    }

    if (Object.keys(updateData).length === 0) {
      onClose();
      return;
    }

    try {
      const updatedTrip = await updateTripMutation.mutateAsync(updateData);
      onTripUpdated(updatedTrip);
      showAlert('Trip settings updated successfully', { type: 'success' });
      onClose();
    } catch (error: unknown) {
      const err = error as { message?: string };
      showAlert(err.message || 'Failed to update trip settings', { type: 'error' });
    }
  };

  const handleDeleteTrip = async () => {
    if (!isAdmin) return;
    
    try {
      await deleteTripMutation.mutateAsync(trip.id.toString());
      showAlert('Trip deleted successfully', { type: 'success' });
      onTripLeft(); // Navigate away since trip is deleted
    } catch (error: unknown) {
      const err = error as { message?: string };
      showAlert(err.message || 'Failed to delete trip', { type: 'error' });
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const handleLeaveTrip = async () => {
    try {
      await leaveTripMutation.mutateAsync();
      showAlert('Left trip successfully', { type: 'success' });
      onTripLeft(); // Navigate away since user left
    } catch (error: unknown) {
      const err = error as { message?: string };
      showAlert(err.message || 'Failed to leave trip', { type: 'error' });
    } finally {
      setShowLeaveConfirm(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Trip Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              Basic Information
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trip Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={!isAdmin}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Enter trip name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                disabled={!isAdmin}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Enter trip description (optional)"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              Dates
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleInputChange('start_date', e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleInputChange('end_date', e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Trip Stats */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-600" />
              Trip Statistics
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Total Spent</div>
                <div className="text-lg font-semibold text-gray-900">
                  {trip.base_currency} {(typeof trip.total_spent === 'number' 
                    ? trip.total_spent.toFixed(2) 
                    : Number(trip.total_spent || 0).toFixed(2))}
                </div>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Expenses</div>
                <div className="text-lg font-semibold text-gray-900">
                  {trip.expense_count || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Actions</h3>
            
            <div className="space-y-3">
              <button
                onClick={() => setShowLeaveConfirm(true)}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                Leave Trip
              </button>
              
              {isAdmin && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Trip
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        {isAdmin && (
          <div className="flex gap-3 p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {updateTripMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Trip</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this trip? This action cannot be undone and will remove all expenses, members, and data associated with this trip.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isLoading}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTrip}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteTripMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <LogOut className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Leave Trip</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to leave this trip? You will no longer have access to the trip's expenses and data.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                disabled={isLoading}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveTrip}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {leaveTripMutation.isPending ? 'Leaving...' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
