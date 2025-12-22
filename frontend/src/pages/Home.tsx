/**
 * Home Page - Trips List
 * Shows all user trips and allows creating new ones
 */
import { useAuth } from '../hooks/useAuth';
import { Plus, LogOut } from 'lucide-react';

export default function Home() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-primary-600 text-white px-6 py-4 safe-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Velo</h1>
            <p className="text-primary-100 text-sm">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 hover:bg-primary-700 rounded-xl transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Your Trips</h2>
          <p className="text-gray-600 text-sm">Manage your travel expenses</p>
        </div>

        {/* Empty state */}
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <Plus className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No trips yet</h3>
          <p className="text-gray-500 mb-6">Create your first trip to start tracking expenses</p>
          <button className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-sm">
            Create Trip
          </button>
        </div>
      </main>

      {/* Bottom Navigation (placeholder) */}
      <nav className="border-t border-gray-200 safe-bottom">
        <div className="grid grid-cols-4 gap-2 px-4 py-3">
          <button className="flex flex-col items-center gap-1 text-primary-600">
            <div className="w-6 h-6 bg-primary-100 rounded-lg"></div>
            <span className="text-xs font-medium">Trips</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <div className="w-6 h-6 bg-gray-100 rounded-lg"></div>
            <span className="text-xs font-medium">Expenses</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <div className="w-6 h-6 bg-gray-100 rounded-lg"></div>
            <span className="text-xs font-medium">Balances</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <div className="w-6 h-6 bg-gray-100 rounded-lg"></div>
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
