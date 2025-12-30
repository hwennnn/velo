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

  /**
   * Upload receipt image to Supabase Storage
   */
  uploadReceipt: async (file: File, tripId: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${tripId}/${crypto.randomUUID()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('receipts')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });
    
    if (error) {
      return { data: null, error };
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName);
    
    return { data: { path: data.path, url: publicUrl }, error: null };
  },

  /**
   * Upload multiple receipt images
   */
  uploadReceipts: async (files: File[], tripId: string) => {
    const results = await Promise.all(
      files.map(file => storage.uploadReceipt(file, tripId))
    );
    
    const urls: string[] = [];
    const errors: Error[] = [];
    
    for (const result of results) {
      if (result.error) {
        errors.push(result.error);
      } else if (result.data) {
        urls.push(result.data.url);
      }
    }
    
    return { urls, errors };
  },

  /**
   * Delete receipt from Supabase Storage
   */
  deleteReceipt: async (path: string) => {
    const { data, error } = await supabase.storage
      .from('receipts')
      .remove([path]);
    
    return { data, error };
  },

  /**
   * Extract path from a public URL for deletion
   */
  getPathFromUrl: (url: string, bucket: 'avatars' | 'receipts') => {
    // URL format: https://xxx.supabase.co/storage/v1/object/public/{bucket}/{path}
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = url.indexOf(marker);
    if (index === -1) return null;
    return url.substring(index + marker.length);
  },
};

