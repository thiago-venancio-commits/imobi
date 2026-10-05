import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service-role client. BYPASSES RLS.
 *
 * Use it only after the caller has been authorized in code (see
 * `requireMaster` / `requireInternal`), and only for work the database
 * cannot do on the user's behalf: Auth admin calls and email sending.
 *
 * Anything that writes tenant data should go through an RPC called with the
 * *user's* client instead, so the database re-checks the permission.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, serverEnv.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
