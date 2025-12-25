/**
 * Profile Page
 * User profile management and settings
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, Edit2, LogOut, Save, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAlert } from '../contexts/AlertContext';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';

export default function Profile() {
  const navigate = useNavigate();
  const { user: authUser, signOut } = useAuth();
  const { showAlert } = useAlert();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);

  // Fetch user profile
  const { data: userProfile, isLoading } = useQuery({
    queryKey: ['user', 'profile'],
    queryFn: () => api.user.getProfile().then(res => res.data),
    enabled: !!authUser,
  });

  // Form state for editing
  const [editForm, setEditForm] = useState({
    display_name: '',
    avatar_url: '',
  });

  // Initialize form when starting to edit
  const startEditing = () => {
    setEditForm({
      display_name: userProfile?.display_name || '',
      avatar_url: userProfile?.avatar_url || '',
    });
    setIsEditing(true);
  };

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: { display_name?: string; avatar_url?: string }) =>
      api.user.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'profile'] });
      setIsEditing(false);
      showAlert('Profile updated successfully', { type: 'success' });
    },
    onError: (error: unknown) => {
      const errorMessage = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to update profile';
      showAlert(errorMessage, { type: 'error' });
    },
  });

  const handleSaveProfile = () => {
    const updates: { display_name?: string; avatar_url?: string } = {};
    
    if (editForm.display_name !== (userProfile?.display_name || '')) {
      updates.display_name = editForm.display_name;
    }
    
    if (editForm.avatar_url !== (userProfile?.avatar_url || '')) {
      updates.avatar_url = editForm.avatar_url;
    }

    if (Object.keys(updates).length > 0) {
      updateProfileMutation.mutate(updates);
    } else {
      setIsEditing(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth/login');
    } catch {
      showAlert('Failed to sign out', { type: 'error' });
    }
  };

  const getAvatarUrl = () => {
    if (isEditing) {
      return editForm.avatar_url || userProfile?.avatar_url;
    }
    return userProfile?.avatar_url;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading profile..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white px-5 py-4 safe-top shadow-sm border-b border-gray-100">
        <div className="flex items-center justify-between mt-4 mb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/trips')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back to trips"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Profile</h1>
              <p className="text-gray-500 text-sm">Manage your account</p>
            </div>
          </div>
          
          {!isEditing ? (
            <button
              onClick={startEditing}
              className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {updateProfileMutation.isPending ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="px-5 pt-6 pb-20">
        {/* Profile Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-4">
              {getAvatarUrl() ? (
                <img
                  src={getAvatarUrl()}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                  onError={(e) => {
                    // Fallback to initials if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : (
                <Avatar
                  member={{
                    id: userProfile?.id ? parseInt(userProfile.id.slice(0, 8), 16) || 0 : 0,
                    display_name: userProfile?.display_name,
                    nickname: userProfile?.display_name || userProfile?.email?.split('@')[0] || 'User',
                    avatar_url: userProfile?.avatar_url,
                  }}
                  size="xl"
                  className="border-4 border-white shadow-lg"
                />
              )}
              
              {isEditing && (
                <div className="absolute -bottom-2 -right-2 bg-primary-600 rounded-full p-2 shadow-lg">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {userProfile?.display_name || 'User'}
            </h2>
            <p className="text-gray-500 text-sm">{userProfile?.email}</p>
          </div>

          {/* Profile Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.display_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, display_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter your display name"
                />
              ) : (
                <p className="text-gray-900 py-2">
                  {userProfile?.display_name || 'Not set'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Picture URL
              </label>
              {isEditing ? (
                <input
                  type="url"
                  value={editForm.avatar_url}
                  onChange={(e) =>
                    setEditForm({ ...editForm, avatar_url: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="https://example.com/avatar.jpg"
                />
              ) : (
                <p className="text-gray-900 py-2 break-words overflow-wrap-anywhere">
                  {userProfile?.avatar_url ? (
                    <a
                      href={userProfile.avatar_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700 underline break-all"
                    >
                      {userProfile.avatar_url}
                    </a>
                  ) : (
                    'Not set'
                  )}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <p className="text-gray-500 py-2 text-sm">
                {userProfile?.email}
                <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                  Cannot be changed
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account</h3>
          
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>

        {/* Account Info */}
        {userProfile?.created_at && (
          <div className="mt-6 text-center text-gray-500 text-sm">
            <p>
              Member since{' '}
              {new Date(userProfile.created_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
