import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Who is making this request.
 *
 * The identity always comes from the session cookie, never from the request
 * body. A body that carries `user_id` or `property_id` describes *what* to act
 * on; it never decides *who* is acting. (Traps #2 and #3 in the kit registry:
 * both existing apps trusted ids from the payload.)
 */

export type AppRole = "master" | "broker" | "owner" | "buyer";

export interface Caller {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  isMaster: boolean;
  isBroker: boolean;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Resolves the caller, or null when nobody is signed in. */
export async function getCaller(): Promise<Caller | null> {
  const supabase = await createClient();

  // getUser() revalidates the JWT with Auth. getSession() only reads the
  // cookie, which a client could have tampered with.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: isMaster }, { data: isBroker }] = await Promise.all([
    supabase.rpc("is_master"),
    supabase.rpc("is_active_broker"),
  ]);

  return {
    userId: user.id,
    email: user.email ?? "",
    emailConfirmed: Boolean(user.email_confirmed_at),
    isMaster: isMaster === true,
    isBroker: isBroker === true,
    supabase,
  };
}

/** Caller must be signed in. */
export async function requireCaller(): Promise<Caller> {
  const caller = await getCaller();
  if (!caller) throw new HttpError(401, "Não autenticado");
  return caller;
}

/** Caller must be the platform Master. */
export async function requireMaster(): Promise<Caller> {
  const caller = await requireCaller();
  if (!caller.isMaster) throw new HttpError(403, "Acesso restrito ao administrador");
  return caller;
}

/** Caller must be an authorized (not pending or blocked) broker. */
export async function requireBroker(): Promise<Caller> {
  const caller = await requireCaller();
  if (!caller.isBroker) throw new HttpError(403, "Acesso restrito a corretores autorizados");
  return caller;
}

/** Caller must be Master or an authorized broker. */
export async function requireStaff(): Promise<Caller> {
  const caller = await requireCaller();
  if (!caller.isMaster && !caller.isBroker) {
    throw new HttpError(403, "Acesso restrito à equipe");
  }
  return caller;
}
