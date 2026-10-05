import "server-only";

/**
 * Secrets. Importing this file from a Client Component is a build error,
 * which is the point: none of these may ever reach the browser.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const serverEnv = {
  serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  cronSecret: () => required("CRON_SECRET"),
  resendApiKey: () => required("RESEND_API_KEY"),
  resendFrom: () => required("RESEND_FROM"),
  turnstileSecret: () => required("TURNSTILE_SECRET_KEY"),
};
