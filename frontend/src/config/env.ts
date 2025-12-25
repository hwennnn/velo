/**
 * Environment configuration
 * All environment variables are accessed through this module
 */

export const env = {
  // Supabase
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },
  
  // Backend API
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  },
  
  // App
  app: {
    name: import.meta.env.VITE_APP_NAME || 'Velo',
    version: import.meta.env.VITE_APP_VERSION || '0.1.0',
  },
  
  // Environment
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const;

// Validate required environment variables
if (!env.supabase.url || !env.supabase.anonKey) {
  console.warn('⚠️  Supabase credentials not found. Auth features will not work.');
  console.warn('   Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
}


