import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session cookie on every navigation, so Server
 * Components always see a valid session.
 *
 * It does NOT authorize anything. Each protected layout and every Server
 * Action resolves the caller itself (`src/lib/server/caller.ts`), and the
 * database refuses the request a second time through RLS. A redirect here is
 * a convenience for the user, not a security boundary.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses that set auth cookies must never be cached by the CDN,
        // or one user's token could be served to another.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|mp4)$).*)",
  ],
};
