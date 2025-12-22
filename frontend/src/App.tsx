/**
 * Main App Component
 * Handles routing and layout
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import MobileContainer from './components/MobileContainer';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './hooks/useAuth';
import AuthCallback from './pages/AuthCallback';
import Home from './pages/Home';
import Login from './pages/Login';
import TripDetail from './pages/TripDetail';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MobileContainer>
          <Routes>
            {/* Public routes */}
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            
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
            
            {/* Redirect root to trips */}
            <Route path="/" element={<Navigate to="/trips" replace />} />
            
            {/* 404 - Redirect to trips */}
            <Route path="*" element={<Navigate to="/trips" replace />} />
          </Routes>
        </MobileContainer>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
