/**
 * Supabase client configuration
 * Handles authentication and database operations
 */
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Create Supabase client
export const supabase = createClient(
  env.supabase.url,
  env.supabase.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: localStorage,
    },
  }
);

// Auth helpers
export const auth = {
  /**
   * Sign in with Google OAuth
   */
  signInWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { data, error };
  },

  /**
   * Sign in with GitHub OAuth
   */
  signInWithGithub: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { data, error };
  },

  /**
   * Sign out
   */
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  /**
   * Get current session
   */
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    return { data, error };
  },

  /**
   * Get current user
   */
  getUser: async () => {
    const { data, error } = await supabase.auth.getUser();
    return { data, error };
  },
};

// Storage helpers
export const storage = {
  /**
   * Upload avatar to Supabase Storage
   */
  uploadAvatar: async (file: File, userId: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${crypto.randomUUID()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });
    
    if (error) {
      return { data: null, error };
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    return { data: { path: data.path, url: publicUrl }, error: null };
  },

  /**
   * Delete avatar from Supabase Storage
   */
  deleteAvatar: async (path: string) => {
    const { data, error } = await supabase.storage
      .from('avatars')
      .remove([path]);
    
    return { data, error };
  },
};

