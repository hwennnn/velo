/**
 * Bottom Navigation Bar Component
 * Reusable navigation bar for main app pages
 */
import { List, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function BottomNavbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isTripsActive = location.pathname === '/trips' || location.pathname.startsWith('/trips/');
  const isAccountActive = location.pathname === '/account';

  return (
    <nav className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom shadow-lg z-20">
      <div className="grid grid-cols-2 gap-1 px-4 py-2">
        <button
          onClick={() => navigate('/trips')}
          className={`flex flex-col items-center gap-1 py-2 transition-colors ${
            isTripsActive
              ? 'text-primary-600'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <List className="w-5 h-5" />
          <span className="text-xs font-medium">Trips</span>
        </button>
        <button
          onClick={() => navigate('/account')}
          className={`flex flex-col items-center gap-1 py-2 transition-colors ${
            isAccountActive
              ? 'text-primary-600'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-xs font-medium">Account</span>
        </button>
      </div>
    </nav>
  );
}

