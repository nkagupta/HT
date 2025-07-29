import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

/**
 * Supabase Configuration and Client Setup
 * 
 * This file initializes the Supabase client with environment variables.
 * Supabase is used for authentication, database operations, and real-time features.
 * 
 * Environment Variables Required:
 * - VITE_SUPABASE_URL: Your Supabase project URL
 * - VITE_SUPABASE_ANON_KEY: Your Supabase anonymous/public key
 */

// Get environment variables from Vite's environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Environment Variables Validation
 * 
 * Only validate when running in browser (not during build process)
 * This prevents build failures when environment variables aren't set during build time
 */
if (typeof window !== 'undefined') {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'your_supabase_project_url' || supabaseAnonKey === 'your_supabase_anon_key') {
    console.error('Missing or invalid Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file with your actual Supabase project credentials.');
  } else {
    // Validate that the Supabase URL is properly formatted
    try {
      new URL(supabaseUrl);
    } catch {
      console.error(`Invalid VITE_SUPABASE_URL: "${supabaseUrl}". Please ensure it's a valid URL like https://your-project-id.supabase.co`);
    }
  }
}

/**
 * Create and export Supabase client
 * 
 * Uses placeholder values during build process to prevent errors
 * The actual values should be set via environment variables in production
 */
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);