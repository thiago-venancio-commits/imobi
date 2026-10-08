import "server-only";

import { redirect } from "next/navigation";

import { type Caller, getCaller } from "@/lib/server/caller";

/**
 * Guardas para páginas e layouts (Server Components).
 *
 * São conveniência de navegação: mandam o usuário para o lugar certo. A
 * barreira de verdade fica no banco (RLS e RPCs), que recusa a operação mesmo
 * que alguém chegue a uma página que não deveria. Um layout que esquece de
 * chamar a guarda mostra uma tela vazia ou um erro — nunca dado alheio.
 */

/** Para onde cada papel vai logo depois de entrar. */
export function homeFor(caller: Pick<Caller, "isMaster" | "isBroker" | "isOwner" | "ownerStatus">): string {
  if (caller.isMaster) return "/master";
  // Proprietário pendente também vai para o painel dele: ele precisa ver o
  // aviso "aguardando aprovação do Master" em vez de uma tela de comprador.
  if (caller.isOwner || caller.ownerStatus === "pendente") return "/proprietario";
  if (caller.isBroker) return "/corretor";
  return "/minha-conta";
}

/** Exige sessão. Sem ela, vai para o login e volta para cá depois. */
export async function requireUser(next: string): Promise<Caller> {
  const caller = await getCaller();
  if (!caller) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return caller;
}

/** Exige o Master. Outro usuário logado volta para a própria área. */
export async function requireMasterPage(next = "/master"): Promise<Caller> {
  const caller = await requireUser(next);
  if (!caller.isMaster) redirect(homeFor(caller));
  return caller;
}

/** Exige proprietário aprovado ou pendente (quem já se candidatou). */
export async function requireOwnerPage(next = "/proprietario"): Promise<Caller> {
  const caller = await requireUser(next);
  if (!caller.isOwner && caller.ownerStatus !== "pendente" && !caller.isMaster) {
    redirect("/anunciar");
  }
  return caller;
}
