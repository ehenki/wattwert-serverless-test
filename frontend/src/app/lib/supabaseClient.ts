// This client is used in the browser only. For server-side usage create a separate helper.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Ensure env variables are present – Next.js exposes them at build time via NEXT_PUBLIC_ prefix.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase environment variables are missing.');
}

// Use a global variable to preserve the client across Hot Module Replacement (HMR) in development.
declare global {
  // eslint-disable-next-line no-var
  var __supabase__: SupabaseClient | undefined;
}

const createBrowserClient = () => createClient(supabaseUrl, supabaseAnonKey);

export const supabase: SupabaseClient =
  globalThis.__supabase__ ?? createBrowserClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__supabase__ = supabase;
}
