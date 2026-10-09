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

/**
 * Exclusão definitiva do anúncio (só o Master; a RPC confere de novo).
 *
 * Ordem importa: primeiro os ARQUIVOS, depois as linhas. Se apagássemos as
 * linhas antes e o Storage falhasse, as fotos públicas continuariam acessíveis
 * pela URL, sem nenhum registro apontando para elas. Assim, se algo falha no
 * meio, o anúncio continua existindo e dá para tentar de novo.
 *
 * Exige digitar o código do imóvel (IMB-00041) para confirmar.
 */
export async function deletePropertyAction(
  propertyId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!uuid.safeParse(propertyId).success) return { error: "Imóvel inválido." };
  const typed = String(formData.get("confirmCode") ?? "").trim().toUpperCase();
  const caller = await master();

  const { data: p } = await caller.supabase.from("properties").select("code").eq("id", propertyId).maybeSingle();
  if (!p) return { error: "Imóvel não encontrado." };
  if (typed !== p.code) {
    return { fieldErrors: { confirmCode: [`Digite ${p.code} para confirmar.`] }, values: { confirmCode: typed } };
  }

  for (const bucket of ["property-media", "property-docs"] as const) {
    for (const folder of [propertyId, `${propertyId}/originais`, `${propertyId}/documentos`]) {
      const { data: files, error: listError } = await caller.supabase.storage.from(bucket).list(folder, { limit: 1000 });
      if (listError) return { error: "Não foi possível apagar os arquivos. Nada foi excluído; tente de novo." };
      // Entradas sem id são as subpastas; elas somem sozinhas quando esvaziam.
      const paths = (files ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
      if (paths.length) {
        const { error } = await caller.supabase.storage.from(bucket).remove(paths);
        if (error) return { error: "Não foi possível apagar os arquivos. Nada foi excluído; tente de novo." };
      }
    }
  }

  const { error } = await caller.supabase.rpc("delete_property", { _property: propertyId });
  if (error) return { error: "Os arquivos foram apagados, mas o anúncio não. Tente excluir de novo." };

  revalidatePath("/master", "layout");
  revalidatePath("/imoveis");
  revalidatePath("/");
  redirect("/master/imoveis?status=todos");
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
