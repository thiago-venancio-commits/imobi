"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/auth/schemas";
import { getCaller } from "@/lib/server/caller";
import { setCover } from "@/lib/server/media";
import type { LocationPrecision, OwnerStatus, PropertyStatus } from "@/lib/supabase/database.types";

/**
 * Ações do Master.
 *
 * A checagem `isMaster` aqui é só para responder bonito. Quem decide é o banco:
 * cada RPC confere `private.is_master()` por dentro, e o trigger da 0007 recusa
 * publicar imóvel de proprietário não aprovado, venha o pedido de onde vier.
 */

async function master() {
  const caller = await getCaller();
  if (!caller) redirect("/entrar?next=/master");
  if (!caller.isMaster) redirect("/");
  return caller;
}

const uuid = z.uuid();

const OWNER_STATUSES = ["pendente", "aprovado", "bloqueado"] as const;
const PROPERTY_STATUSES = [
  "rascunho", "aguardando_aprovacao", "aprovado", "publicado", "reservado", "em_negociacao",
  "vendido", "alugado", "pausado", "rejeitado", "cancelado",
] as const;

function refreshProperty(propertyId: string) {
  revalidatePath(`/master/imoveis/${propertyId}`);
  revalidatePath("/master/imoveis");
  revalidatePath("/master");
  revalidatePath("/imoveis");
  revalidatePath("/");
}

export async function setOwnerStatusAction(userId: string, status: OwnerStatus): Promise<void> {
  if (!uuid.safeParse(userId).success || !OWNER_STATUSES.includes(status)) return;
  const caller = await master();
  await caller.supabase.rpc("set_owner_status", { _user: userId, _status: status });
  revalidatePath("/master/proprietarios");
  revalidatePath("/master/imoveis", "layout");
  revalidatePath("/master");
}

export async function setPropertyStatusAction(
  propertyId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!uuid.safeParse(propertyId).success) return { error: "Imóvel inválido." };
  const status = formData.get("status");
  const reason = String(formData.get("reason") ?? "").trim();
  if (typeof status !== "string" || !(PROPERTY_STATUSES as readonly string[]).includes(status)) {
    return { error: "Status inválido." };
  }
  if (status === "rejeitado" && reason.length < 5) {
    return { fieldErrors: { reason: ["Explique ao proprietário o que precisa ser ajustado."] } };
  }
  const caller = await master();

  const { error } = await caller.supabase.rpc("set_property_status", {
    _property: propertyId,
    _status: status as PropertyStatus,
    _reason: status === "rejeitado" ? reason : undefined,
  });
  if (error) {
    if (error.message.includes("owner_not_approved")) {
      return { error: "Aprove o proprietário antes de aprovar ou publicar o imóvel." };
    }
    return { error: "Não foi possível alterar o status agora." };
  }

  refreshProperty(propertyId);
  return { message: "Status atualizado." };
}

export async function setCoverAsMasterAction(propertyId: string, mediaId: string): Promise<void> {
  if (!uuid.safeParse(propertyId).success || !uuid.safeParse(mediaId).success) return;
  const caller = await master();
  await setCover(caller.supabase, propertyId, mediaId);
  refreshProperty(propertyId);
}

export async function setLocationPrecisionAction(propertyId: string, formData: FormData): Promise<void> {
  const precision = formData.get("precision");
  if (!uuid.safeParse(propertyId).success) return;
  if (precision !== "bairro" && precision !== "aproximado" && precision !== "exato") return;
  const caller = await master();
  await caller.supabase.rpc("set_property_location_precision", {
    _property: propertyId,
    _precision: precision as LocationPrecision,
  });
  refreshProperty(propertyId);
}

export async function setCommissionAction(
  propertyId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!uuid.safeParse(propertyId).success) return { error: "Imóvel inválido." };
  const raw = String(formData.get("commission") ?? "").replace(",", ".").trim();
  const pct = raw === "" ? null : Number(raw);
  if (pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
    return { fieldErrors: { commission: ["Use um percentual entre 0 e 100."] }, values: { commission: raw } };
  }
  const caller = await master();
  const { error } = await caller.supabase.rpc("set_property_commission", {
    _property: propertyId,
    _pct: pct as number,
  });
  if (error) return { error: "Não foi possível salvar a comissão." };
  refreshProperty(propertyId);
  return { message: "Comissão salva." };
}

const settingsSchema = z.object({
  masterWhatsapp: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.union([z.literal(""), z.string().min(12, "Use DDI + DDD + número, ex.: 5531999998888.").max(13)])),
  masterEmail: z.union([z.literal(""), z.email("E-mail inválido.")]),
});

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    masterWhatsapp: String(formData.get("masterWhatsapp") ?? ""),
    masterEmail: String(formData.get("masterEmail") ?? "").trim(),
  };
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const caller = await master();

  const { data, error } = await caller.supabase
    .from("site_settings")
    .update({ master_whatsapp: parsed.data.masterWhatsapp, master_email: parsed.data.masterEmail })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) return { error: "Não foi possível salvar.", values };

  revalidatePath("/", "layout");
  return { message: "Configurações salvas." };
}
