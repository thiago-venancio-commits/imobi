/**
 * Environment access. Both halves throw when a variable is missing.
 *
 * There is deliberately no fallback value anywhere in this file: a hardcoded
 * fallback makes a misconfigured preview or fork talk to production without
 * anyone noticing (trap #12 in the tenancy kit's registry).
 */

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/**
 * Safe in the browser. Next.js inlines NEXT_PUBLIC_* at build time, so these
 * must be read as full literal property accesses, not through a dynamic key.
 */
export const publicEnv = {
  supabaseUrl: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  supabaseKey: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
};

export function appUrl(path = "/"): string {
  return new URL(path, publicEnv.siteUrl).toString();
}
