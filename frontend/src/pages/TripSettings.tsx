import { AlertTriangle, ArrowLeft, Calendar, FileText, LogOut, Settings, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAlert } from '../contexts/AlertContext';
import { useAuth } from '../hooks/useAuth';
import { useLeaveTrip } from '../hooks/useMembers';
import { useDeleteTrip, useTrip, useUpdateTrip } from '../hooks/useTrips';
import type { Trip } from '../types';

/**
 * Trip Settings Page
 * Allows updating basic trip details and leaving/deleting the trip.
 */
export default function TripSettings() {
    const { tripId } = useParams<{ tripId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showAlert } = useAlert();

    const { data: trip, isLoading: tripLoading } = useTrip(tripId);
    const updateTripMutation = useUpdateTrip(tripId!);
    const deleteTripMutation = useDeleteTrip();
    const leaveTripMutation = useLeaveTrip(tripId!);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        simplify_debts: false,
    });

    const isAdmin = useMemo(() => {
        return trip?.members?.some((member) => member.user_id === user?.id && member.is_admin) ?? false;
    }, [trip, user?.id]);

    const isMutating = updateTripMutation.isPending || deleteTripMutation.isPending || leaveTripMutation.isPending;

    useEffect(() => {
        if (!trip) return;
        setFormData({
            name: trip.name,
            description: trip.description || '',
            start_date: trip.start_date || '',
            end_date: trip.end_date || '',
            simplify_debts: !!trip.simplify_debts,
        });
    }, [trip]);

    const handleInputChange = (field: keyof Trip | 'simplify_debts', value: string | boolean) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSave = async () => {
        if (!trip || !isAdmin) return;

        const updateData: Record<string, unknown> = {};

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
        if (!!formData.simplify_debts !== !!trip.simplify_debts) {
            updateData.simplify_debts = formData.simplify_debts;
        }

        if (Object.keys(updateData).length === 0) {
            showAlert('No changes to save', { type: 'info' });
            return;
        }

        try {
            await updateTripMutation.mutateAsync(updateData);
            showAlert('Trip settings updated successfully', { type: 'success' });
        } catch (error: unknown) {
            const err = error as { message?: string };
            showAlert(err.message || 'Failed to update trip settings', { type: 'error' });
        }
    };

    const handleDeleteTrip = async () => {
        try {
            await deleteTripMutation.mutateAsync(tripId!);
            showAlert('Trip deleted successfully', { type: 'success' });
            navigate('/trips');
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
            navigate('/trips');
        } catch (error: unknown) {
            const err = error as { message?: string };
            showAlert(err.message || 'Failed to leave trip', { type: 'error' });
        } finally {
            setShowLeaveConfirm(false);
        }
    };

    if (tripLoading && !trip) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-gray-600">Loading trip settings...</div>
            </div>
        );
    }

    if (!trip || !tripId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center space-y-3">
                    <p className="text-gray-800 font-semibold">Trip not found</p>
                    <button
                        onClick={() => navigate('/trips')}
                        className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                        Back to trips
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/trips/${tripId}`)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        aria-label="Back to trip"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Settings className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">Trip Settings</h1>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                    <div className="p-6 space-y-4">
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-gray-600" />
                                Basic Information
                            </h2>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">Trip Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => handleInputChange('name', e.target.value)}
                                        disabled={!isAdmin}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                        placeholder="Enter trip name"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">Description</label>
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
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-gray-600" />
                                Dates
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">Start Date</label>
                                    <input
                                        type="date"
                                        value={formData.start_date}
                                        onChange={(e) => handleInputChange('start_date', e.target.value)}
                                        disabled={!isAdmin}
                                        className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">End Date</label>
                                    <input
                                        type="date"
                                        value={formData.end_date}
                                        onChange={(e) => handleInputChange('end_date', e.target.value)}
                                        disabled={!isAdmin}
                                        className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-gray-600" />
                                Balance Settings
                            </h2>

                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.simplify_debts}
                                        onChange={(e) => handleInputChange('simplify_debts', e.target.checked)}
                                        disabled={!isAdmin}
                                        className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                                    />
                                    <div>
                                        <div className="text-sm font-semibold text-gray-900">Simplify debts</div>
                                        <div className="text-xs text-gray-600 mt-1">
                                            When enabled, balances will show a minimized set of transactions to settle up.
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {isAdmin ? (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => navigate(`/trips/${tripId}`)}
                                    disabled={isMutating}
                                    className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isMutating}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {updateTripMutation.isPending ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        ) : (
                            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                Only trip admins can update these settings.
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                    <div className="p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900">Danger Zone</h2>
                        <div className="space-y-3">
                            <button
                                onClick={() => setShowLeaveConfirm(true)}
                                disabled={isMutating}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                            >
                                <LogOut className="w-4 h-4" />
                                Leave Trip
                            </button>

                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={!isAdmin || isMutating}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Trip
                            </button>
                            {!isAdmin && (
                                <p className="text-xs text-gray-500 text-center">Only admins can delete a trip.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
                                disabled={isMutating}
                                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteTrip}
                                disabled={isMutating}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {deleteTripMutation.isPending ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showLeaveConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
                                disabled={isMutating}
                                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleLeaveTrip}
                                disabled={isMutating}
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

