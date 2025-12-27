/**
 * Auth Callback Page
 * Handles OAuth callback and redirects to app
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { supabase } from '../services/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle the OAuth callback
    const handleCallback = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // Extract profile information from OAuth providers
          const userMetadata = session.user.user_metadata;
          const displayName = userMetadata?.full_name || userMetadata?.name || session.user.email?.split('@')[0];
          const avatarUrl = userMetadata?.avatar_url || userMetadata?.picture;

          // Register user in our database (will be skipped if already exists)
          try {
            await api.user.register({
              user_id: session.user.id,
              email: session.user.email!,
              display_name: displayName,
              avatar_url: avatarUrl,
            });
          } catch (error) {
            // Ignore registration errors (user might already exist)
            console.error('User registration skipped or failed:', error);
          }

          // Successfully authenticated, redirect to trips
          navigate('/trips');
        } else {
          // No session, redirect to login
          navigate('/auth/login');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/auth/login');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Signing you in...</p>
      </div>
    </div>
  );
}

