import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/** Browser client. Carries the user's session; every query is subject to RLS. */
export function createClient() {
  return createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey);
}
