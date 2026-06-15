/**
 * Supabase client for Fastify backend.
 *
 * Uses @supabase/supabase-js directly (NOT @supabase/ssr which is Next.js-only).
 * Provides both an anonymous (publishable) client and an admin client
 * using the service_role key for backend-to-database operations.
 *
 * Lazy initialization — client is created on first access to keep RAM < 50MB.
 *
 * @module shared/database/supabase
 */

import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";

let supabaseAdmin: ReturnType<typeof createClient> | null = null;
let supabaseAnon: ReturnType<typeof createClient> | null = null;

/**
 * Returns a Supabase admin client with service_role privileges.
 * Use this for server-side operations that bypass RLS (e.g., tenant provisioning).
 */
export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    }
    supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdmin;
}

/**
 * Returns a Supabase anonymous client (publishable key / anon key).
 * Use for public-facing operations or when RLS policies handle authorization.
 */
export function getSupabaseAnon() {
  if (!supabaseAnon) {
    supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAnon;
}

/**
 * Validates the Supabase connection by running a simple query.
 * @returns true if connection is healthy
 */
export async function validateSupabaseConnection(): Promise<boolean> {
  try {
    const client = getSupabaseAnon();
    const { error } = await client.from("_health_check").select("*").limit(1).maybeSingle();
    // If the table doesn't exist, we just check that auth works
    return !error || error.code === "42P01"; // 42P01 = relation not found (expected)
  } catch {
    return false;
  }
}
