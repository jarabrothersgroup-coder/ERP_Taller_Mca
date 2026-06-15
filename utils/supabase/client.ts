/**
 * Supabase Browser Client — Next.js Client Components.
 *
 * Migration reference for future Next.js frontend.
 * ⚠️ This file is NOT used by the current Fastify backend.
 *
 * @module utils/supabase/client
 */

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createClient = () =>
  createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
  );
