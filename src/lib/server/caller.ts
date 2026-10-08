import "server-only";

import { cache } from "react";

import type { BrokerStatus, OwnerStatus } from "@/lib/supabase/database.types";
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
  /** Corretor AUTORIZADO. Candidato pendente ou bloqueado não conta. */
  isBroker: boolean;
  /** Proprietário APROVADO pelo Master. */
  isOwner: boolean;
  brokerStatus: BrokerStatus | null;
  ownerStatus: OwnerStatus | null;
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

/**
 * Resolves the caller, or null when nobody is signed in.
 *
 * Memoizado por requisição (`cache` do React): o layout e a página chamam isto
 * e só a primeira vai ao Auth e ao banco. Não vaza entre requisições, porque o
 * cache do React vive só durante uma renderização no servidor.
 */
export const getCaller = cache(async (): Promise<Caller | null> => {
  const supabase = await createClient();

  // getUser() revalidates the JWT with Auth. getSession() only reads the
  // cookie, which a client could have tampered with.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Uma ida ao banco para todos os papéis. my_roles() só responde sobre quem
  // chama (usa auth.uid() por dentro), então não há parâmetro para forjar.
  const { data } = await supabase.rpc("my_roles");
  const roles = data?.[0];

  return {
    userId: user.id,
    email: user.email ?? "",
    emailConfirmed: Boolean(user.email_confirmed_at),
    isMaster: roles?.is_master === true,
    isBroker: roles?.is_broker === true,
    isOwner: roles?.is_owner === true,
    brokerStatus: roles?.broker_status ?? null,
    ownerStatus: roles?.owner_status ?? null,
    supabase,
  };
});

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
