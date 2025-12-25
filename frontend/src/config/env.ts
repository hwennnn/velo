/**
 * Environment configuration
 * All environment variables are accessed through this module
 */

export const env = {
  // Supabase - These must be set at runtime, no defaults for security
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },

  // Backend API - Default for development, must be set in production
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000/api' : ''),
  },

  // App - Safe defaults that can be customized
  app: {
    name: import.meta.env.VITE_APP_NAME || 'Velo',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  },

  // Environment
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const;

// Validate required environment variables
if (!env.supabase.url || !env.supabase.anonKey) {
  const envFile = import.meta.env.DEV ? '.env.local' : 'environment variables';
  console.warn('⚠️  Supabase credentials not found. Authentication features will not work.');
  console.warn(`   Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in ${envFile}`);
}

if (import.meta.env.PROD && !env.api.baseUrl) {
  console.warn('⚠️  Production build detected but VITE_API_BASE_URL is not set.');
  console.warn('   Please set the API base URL in your deployment environment variables.');
}


