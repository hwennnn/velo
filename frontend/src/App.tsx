/**
 * Main App Component
 * Handles routing and layout
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import MobileContainer from './components/MobileContainer';
import ProtectedRoute from './components/ProtectedRoute';
import { AlertProvider } from './contexts/AlertContext';
import { AuthProvider } from './hooks/useAuth';
import AuthCallback from './pages/AuthCallback';
import Home from './pages/Home';
import JoinTrip from './pages/JoinTrip';
import Login from './pages/Login';
import TripDetail from './pages/TripDetail';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AlertProvider>
          <MobileContainer>
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
              
              {/* Redirect root to trips */}
              <Route path="/" element={<Navigate to="/trips" replace />} />
              
              {/* 404 - Redirect to trips */}
              <Route path="*" element={<Navigate to="/trips" replace />} />
            </Routes>
          </MobileContainer>
        </AlertProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
