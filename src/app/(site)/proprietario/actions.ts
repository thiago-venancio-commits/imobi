"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/auth/schemas";
import {
  MISSING_LABELS,
  newPropertySchema,
  ownerApplicationSchema,
  propertyDetailsSchema,
  propertyLocationSchema,
  propertyValuesSchema,
} from "@/lib/owner/schemas";
import { getCaller } from "@/lib/server/caller";
import { geocodeAddress } from "@/lib/server/geocode";
import type { PropertyPurpose, PropertyType } from "@/lib/supabase/database.types";

/**
 * Ações do proprietário.
 *
 * Todas usam o cliente DO USUÁRIO: quem é dono de qual imóvel quem decide é a
 * RLS e as RPCs do banco. O `propertyId` que chega aqui diz SOBRE QUAL imóvel
 * agir; se não for do usuário, o banco devolve zero linhas e a ação responde
 * "não encontrado" — nunca altera o imóvel de outra pessoa.
 */

const uuid = z.uuid();

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

function fieldErrors(error: z.ZodError): ActionState["fieldErrors"] {
  return z.flattenError(error).fieldErrors;
}

function values(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}

async function signedIn() {
  const caller = await getCaller();
  if (!caller) redirect("/entrar");
  return caller;
}

const NOT_FOUND: ActionState = { error: "Imóvel não encontrado ou você não tem acesso a ele." };
const GENERIC: ActionState = { error: "Não foi possível salvar agora. Tente novamente em instantes." };

function refresh(propertyId: string) {
  revalidatePath(`/proprietario/imoveis/${propertyId}`);
  revalidatePath("/proprietario");
}

// ---------------------------------------------------------------------------
// Candidatura (/anunciar)
// ---------------------------------------------------------------------------
export async function applyAsOwnerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const caller = await signedIn();
  const parsed = ownerApplicationSchema.safeParse({
    fullName: field(formData, "fullName"),
    phone: field(formData, "phone"),
    whatsapp: field(formData, "whatsapp"),
    cpfCnpj: field(formData, "cpfCnpj"),
    declare: formData.get("declare") ?? undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: values(formData) };

  const { error } = await caller.supabase.rpc("apply_as_owner", {
    _full_name: parsed.data.fullName,
    _phone: parsed.data.phone,
    _whatsapp: parsed.data.whatsapp,
    _cpf_cnpj: parsed.data.cpfCnpj,
  });
  if (error) {
    if (error.message.includes("blocked")) {
      return { error: "Sua conta de proprietário está bloqueada. Fale com a nossa equipe." };
    }
    return { ...GENERIC, values: values(formData) };
  }

  revalidatePath("/", "layout");
  redirect("/proprietario/imoveis/novo");
}

// ---------------------------------------------------------------------------
// Novo imóvel
// ---------------------------------------------------------------------------
export async function createPropertyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const caller = await signedIn();
  const parsed = newPropertySchema.safeParse({
    type: field(formData, "type"),
    purpose: field(formData, "purpose"),
    title: field(formData, "title"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: values(formData) };

  const { data: id, error } = await caller.supabase.rpc("create_property", {
    _type: parsed.data.type as PropertyType,
    _purpose: parsed.data.purpose as PropertyPurpose,
    _title: parsed.data.title,
  });
  if (error || !id) {
    if (error?.message.includes("not_an_owner")) redirect("/anunciar");
    return { ...GENERIC, values: values(formData) };
  }

  revalidatePath("/proprietario");
  redirect(`/proprietario/imoveis/${id}?novo=1`);
}

// ---------------------------------------------------------------------------
// Seções do cadastro
// ---------------------------------------------------------------------------
export async function saveDetailsAction(
  propertyId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!uuid.safeParse(propertyId).success) return NOT_FOUND;
  const caller = await signedIn();
  const parsed = propertyDetailsSchema.safeParse({
    title: field(formData, "title"),
    description: field(formData, "description"),
    type: field(formData, "type"),
    purpose: field(formData, "purpose"),
    condition: field(formData, "condition"),
    inCondominium: formData.get("inCondominium") === "on",
    bedrooms: field(formData, "bedrooms"),
    suites: field(formData, "suites"),
    bathrooms: field(formData, "bathrooms"),
    parkingSpaces: field(formData, "parkingSpaces"),
    totalArea: field(formData, "totalArea"),
    builtArea: field(formData, "builtArea"),
    landArea: field(formData, "landArea"),
    condoFee: field(formData, "condoFee"),
    features: field(formData, "features"),
    amenities: field(formData, "amenities"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: values(formData) };
  const d = parsed.data;

  const { data, error } = await caller.supabase
    .from("properties")
    .update({
      title: d.title,
      description: d.description,
      type: d.type as PropertyType,
      purpose: d.purpose as PropertyPurpose,
      condition: d.condition,
      in_condominium: d.inCondominium,
      bedrooms: d.bedrooms,
      suites: d.suites,
      bathrooms: d.bathrooms,
      parking_spaces: d.parkingSpaces,
      total_area: d.totalArea,
      built_area: d.builtArea,
      land_area: d.landArea,
      condo_fee: d.condoFee,
      features: d.features,
      amenities: d.amenities,
    })
    .eq("id", propertyId)
    .select("id");
  if (error) return { ...GENERIC, values: values(formData) };
  if (!data?.length) return NOT_FOUND;

  refresh(propertyId);
  return { message: "Dados salvos." };
}

export async function saveLocationAction(
  propertyId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!uuid.safeParse(propertyId).success) return NOT_FOUND;
  const caller = await signedIn();
  const parsed = propertyLocationSchema.safeParse({
    cep: field(formData, "cep"),
    address: field(formData, "address"),
    streetNumber: field(formData, "streetNumber"),
    complement: field(formData, "complement"),
    neighborhood: field(formData, "neighborhood"),
    city: field(formData, "city"),
    state: field(formData, "state"),
    landmarks: field(formData, "landmarks"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: values(formData) };
  const d = parsed.data;

  // Metade pública: só bairro, cidade, estado e pontos de referência.
  const { data, error } = await caller.supabase
    .from("properties")
    .update({ neighborhood: d.neighborhood, city: d.city, state: d.state, landmarks: d.landmarks })
    .eq("id", propertyId)
    .select("id");
  if (error) return { ...GENERIC, values: values(formData) };
  if (!data?.length) return NOT_FOUND;

  // Metade privada: endereço exato e a coordenada. O banco publica só uma
  // coordenada deslocada (trigger em 0002).
  const point = await geocodeAddress({
    street: d.address,
    number: d.streetNumber,
    city: d.city,
    state: d.state,
    cep: d.cep,
  });
  const { error: privError } = await caller.supabase
    .from("property_private")
    .update({
      cep: d.cep,
      address: d.address,
      street_number: d.streetNumber,
      complement: d.complement,
      exact_lat: point?.lat ?? null,
      exact_lng: point?.lng ?? null,
    })
    .eq("property_id", propertyId);
  if (privError) return { ...GENERIC, values: values(formData) };

  refresh(propertyId);
  return {
    message: point
      ? "Endereço salvo. O anúncio mostra só a região aproximada, nunca o endereço."
      : "Endereço salvo. Não localizamos o ponto no mapa; o anúncio vai mostrar só o bairro.",
  };
}

export async function saveValuesAction(
  propertyId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!uuid.safeParse(propertyId).success) return NOT_FOUND;
  const caller = await signedIn();
  const parsed = propertyValuesSchema.safeParse({
    priceSale: field(formData, "priceSale"),
    priceRent: field(formData, "priceRent"),
    minPrice: field(formData, "minPrice"),
    downPayment: field(formData, "downPayment"),
    commercialConditions: field(formData, "commercialConditions"),
    acceptsFinancing: formData.get("acceptsFinancing") === "on",
    acceptsTrade: formData.get("acceptsTrade") === "on",
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: values(formData) };
  const d = parsed.data;

  const { data, error } = await caller.supabase
    .from("property_private")
    .update({
      price_sale: d.priceSale,
      price_rent: d.priceRent,
      min_price: d.minPrice,
      down_payment: d.downPayment,
      commercial_conditions: d.commercialConditions,
      accepts_financing: d.acceptsFinancing,
      accepts_trade: d.acceptsTrade,
    })
    .eq("property_id", propertyId)
    .select("property_id");
  if (error) return { ...GENERIC, values: values(formData) };
  if (!data?.length) return NOT_FOUND;

  refresh(propertyId);
  return { message: "Valores salvos. Só você e a equipe TSV veem estes números." };
}

export async function submitPropertyAction(propertyId: string): Promise<ActionState> {
  if (!uuid.safeParse(propertyId).success) return NOT_FOUND;
  const caller = await signedIn();
  const { error } = await caller.supabase.rpc("submit_property", { _property: propertyId });

  if (error) {
    const m = /incomplete:([a-z_,]+)/.exec(error.message);
    if (m) {
      const items = m[1].split(",").map((k) => MISSING_LABELS[k] ?? k);
      return { error: `Antes de enviar, falta preencher: ${items.join(", ")}.` };
    }
    if (error.message.includes("invalid_status")) {
      return { error: "Este imóvel já está em análise ou publicado." };
    }
    if (error.message.includes("forbidden")) return NOT_FOUND;
    return GENERIC;
  }

  refresh(propertyId);
  return { message: "Enviado! Nossa equipe vai analisar e avisar você." };
}

// ---------------------------------------------------------------------------
// Fotos, vídeos e documentos
//
// O arquivo já subiu direto do navegador para o Storage (a policy do bucket só
// aceita a pasta de um imóvel do próprio usuário). Aqui só registramos o
// caminho. Os CHECKs do banco garantem que o caminho é da pasta deste imóvel.
// ---------------------------------------------------------------------------
const mediaInput = z.object({
  propertyId: z.uuid(),
  path: z.string().min(1).max(300),
  originalPath: z.string().min(1).max(300),
  kind: z.enum(["foto", "video"]),
});

export async function registerMediaAction(
  input: z.input<typeof mediaInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = mediaInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Arquivo inválido." };
  const { propertyId, path, originalPath, kind } = parsed.data;
  if (!path.startsWith(`${propertyId}/`) || !originalPath.startsWith(`${propertyId}/originais/`)) {
    return { ok: false, error: "Arquivo inválido." };
  }
  const caller = await signedIn();

  const { data: existing } = await caller.supabase
    .from("property_media")
    .select("position, is_cover")
    .eq("property_id", propertyId)
    .order("position", { ascending: false });
  const nextPosition = (existing?.[0]?.position ?? -1) + 1;
  const hasCover = existing?.some((m) => m.is_cover) ?? false;

  const { data: media, error } = await caller.supabase
    .from("property_media")
    .insert({
      property_id: propertyId,
      storage_path: path,
      kind,
      position: nextPosition,
      is_cover: !hasCover && kind === "foto",
    })
    .select("id")
    .single();
  if (error || !media) return { ok: false, error: "Não foi possível registrar o arquivo." };

  const { error: origError } = await caller.supabase
    .from("property_media_originals")
    .insert({ media_id: media.id, property_id: propertyId, storage_path: originalPath });
  if (origError) {
    await caller.supabase.from("property_media").delete().eq("id", media.id);
    return { ok: false, error: "Não foi possível registrar o arquivo." };
  }

  refresh(propertyId);
  return { ok: true };
}

export async function removeMediaAction(propertyId: string, mediaId: string): Promise<void> {
  if (!uuid.safeParse(propertyId).success || !uuid.safeParse(mediaId).success) return;
  const caller = await signedIn();

  const { data: media } = await caller.supabase
    .from("property_media")
    .select("id, storage_path, is_cover, property_media_originals(storage_path)")
    .eq("id", mediaId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!media) return;

  const { error } = await caller.supabase.from("property_media").delete().eq("id", mediaId);
  if (error) return;

  // A FK é composta (id, property_id), então o PostgREST tipa como lista.
  const original = media.property_media_originals?.[0]?.storage_path;
  await caller.supabase.storage.from("property-media").remove([media.storage_path]);
  if (original) await caller.supabase.storage.from("property-docs").remove([original]);

  // A capa saiu: a próxima foto vira capa.
  if (media.is_cover) {
    const { data: next } = await caller.supabase
      .from("property_media")
      .select("id")
      .eq("property_id", propertyId)
      .eq("kind", "foto")
      .order("position")
      .limit(1)
      .maybeSingle();
    if (next) await caller.supabase.from("property_media").update({ is_cover: true }).eq("id", next.id);
  }

  refresh(propertyId);
}

export async function setCoverAction(propertyId: string, mediaId: string): Promise<void> {
  if (!uuid.safeParse(propertyId).success || !uuid.safeParse(mediaId).success) return;
  const caller = await signedIn();
  // Índice único de uma capa por imóvel: tira a atual antes de marcar a nova.
  await caller.supabase
    .from("property_media")
    .update({ is_cover: false })
    .eq("property_id", propertyId)
    .eq("is_cover", true);
  await caller.supabase
    .from("property_media")
    .update({ is_cover: true })
    .eq("id", mediaId)
    .eq("property_id", propertyId)
    .eq("kind", "foto");
  refresh(propertyId);
}

export async function moveMediaAction(propertyId: string, mediaId: string, direction: -1 | 1): Promise<void> {
  if (!uuid.safeParse(propertyId).success || !uuid.safeParse(mediaId).success) return;
  const caller = await signedIn();
  const { data: list } = await caller.supabase
    .from("property_media")
    .select("id, position")
    .eq("property_id", propertyId)
    .order("position");
  if (!list) return;
  const i = list.findIndex((m) => m.id === mediaId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return;

  // Renumera tudo em sequência: posições repetidas de uploads antigos somem.
  const order = list.map((m) => m.id);
  [order[i], order[j]] = [order[j], order[i]];
  await Promise.all(
    order.map((id, position) => caller.supabase.from("property_media").update({ position }).eq("id", id)),
  );
  refresh(propertyId);
}

const documentInput = z.object({
  propertyId: z.uuid(),
  path: z.string().min(1).max(300),
  label: z.string().trim().min(1).max(120),
});

export async function registerDocumentAction(
  input: z.input<typeof documentInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = documentInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Documento inválido." };
  const { propertyId, path, label } = parsed.data;
  if (!path.startsWith(`${propertyId}/documentos/`)) return { ok: false, error: "Documento inválido." };
  const caller = await signedIn();

  const { error } = await caller.supabase
    .from("property_documents")
    .insert({ property_id: propertyId, storage_path: path, label });
  if (error) return { ok: false, error: "Não foi possível registrar o documento." };

  refresh(propertyId);
  return { ok: true };
}

export async function removeDocumentAction(propertyId: string, documentId: string): Promise<void> {
  if (!uuid.safeParse(propertyId).success || !uuid.safeParse(documentId).success) return;
  const caller = await signedIn();
  const { data: doc } = await caller.supabase
    .from("property_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!doc) return;
  const { error } = await caller.supabase.from("property_documents").delete().eq("id", documentId);
  if (error) return;
  await caller.supabase.storage.from("property-docs").remove([doc.storage_path]);
  refresh(propertyId);
}
