/**
 * Main App Component
 * Handles routing and layout
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import MobileContainer from './components/MobileContainer';
import ProtectedRoute from './components/ProtectedRoute';
import { AlertProvider } from './contexts/AlertContext';
import { AuthProvider } from './hooks/useAuth';
import { queryClient } from './lib/queryClient';

// Lazy load pages for better initial load performance
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Home = lazy(() => import('./pages/Home'));
const JoinTrip = lazy(() => import('./pages/JoinTrip'));
const Login = lazy(() => import('./pages/Login'));
const Profile = lazy(() => import('./pages/Profile'));
const TripDetail = lazy(() => import('./pages/TripDetail'));

// Custom loading component with brand styling
function PageLoader() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        {/* Velo logo */}
        <div className="relative">
          <img
            src="/public/velo.svg"
            alt="Velo"
            className="w-20 h-20 animate-pulse"
          />
        </div>
        
        {/* Loading text with fade animation */}
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900 animate-pulse">Velo</h2>
          <p className="text-gray-600 text-sm animate-pulse">Loading your trips...</p>
        </div>
        
        {/* Animated dots */}
        <div className="flex gap-2">
          <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AlertProvider>
            <MobileContainer>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/auth/login" element={<Login />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/join" element={<JoinTrip />} />
                  
                  {/* Protected routes */}
                  <Route
                    path="/trips"
                    element={
                      <ProtectedRoute>
                        <Home />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/trips/:tripId"
                    element={
                      <ProtectedRoute>
                        <TripDetail />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/account"
                    element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Redirect root to trips */}
                  <Route path="/" element={<Navigate to="/trips" replace />} />
                  
                  {/* 404 - Redirect to trips */}
                  <Route path="*" element={<Navigate to="/trips" replace />} />
                </Routes>
              </Suspense>
            </MobileContainer>
          </AlertProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
