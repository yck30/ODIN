import { createClient, SupabaseClient } from "@supabase/supabase-js";

let serverClientInstance: SupabaseClient | null = null;

/**
 * Server-only Supabase client initialized with the Service Role Key.
 *
 * Security Assertions:
 * - Throws immediately if invoked in browser / client runtime (FR-12).
 * - Bypasses RLS to allow server-side API routes to manage encrypted sessions.
 */
export function getServerSupabaseClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("Security Violation: Attempted to access server-side Supabase client in browser context.");
  }

  if (serverClientInstance) {
    return serverClientInstance;
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error("Supabase configuration error: NEXT_PUBLIC_SUPABASE_URL is missing.");
  }
  if (!serviceRoleKey) {
    throw new Error("Supabase security error: SUPABASE_SERVICE_ROLE_KEY is missing from server environment.");
  }

  serverClientInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serverClientInstance;
}

/**
 * Creates an unprivileged Anonymous client using NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Used exclusively for testing and verifying Row-Level Security (RLS) enforcement (FR-16).
 */
export function getAnonSupabaseClient(): SupabaseClient {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)?.trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase anon client error: URL or Anon key is missing.");
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
