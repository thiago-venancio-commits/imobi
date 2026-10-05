import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Request-scoped client that acts as the signed-in user. RLS applies.
 * Create a new one per request — never cache it across requests.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // src/proxy.ts refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Anonymous client for public pages (property listings, property detail).
 * It sends no session, so it can only ever read what `anon` is granted —
 * which is the public half of the schema, never prices or contacts.
 */
export function createAnonClient() {
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
