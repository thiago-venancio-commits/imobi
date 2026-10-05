import "server-only";

import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";

import { HttpError } from "@/lib/server/caller";
import { serverEnv } from "@/lib/server/env";

/**
 * Guard for cron and internal endpoints.
 *
 * It fails CLOSED. `serverEnv.cronSecret()` throws when CRON_SECRET is unset,
 * so a misconfigured deploy returns an error instead of leaving the endpoint
 * open to the world. Trap #6 in the kit registry is the opposite shape —
 * `if (expected && got !== expected)` — which is a public endpoint whenever
 * the variable is missing.
 */
export function requireInternal(req: Request): void {
  const expected = serverEnv.cronSecret();

  const header = req.headers.get("authorization") ?? "";
  const got = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!got || !timingSafeEqual(got, expected)) {
    throw new HttpError(401, "Não autorizado");
  }
}

/** Constant-time compare that does not leak the secret's length. */
export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return nodeTimingSafeEqual(bufA, bufB);
}
