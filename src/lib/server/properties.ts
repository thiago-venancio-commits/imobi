import "server-only";

import { createAnonClient } from "@/lib/supabase/server";
import {
  mediaUrl,
  PUBLIC_PROPERTY_COLUMNS,
  type PropertyFilters,
  type PublicProperty,
} from "@/lib/properties";
import type { PropertyPurpose, PropertyType } from "@/lib/supabase/database.types";

/**
 * Leitura da vitrine pública.
 *
 * Usa o cliente ANÔNIMO de propósito, mesmo quando há alguém logado: a vitrine
 * mostra a todos exatamente o mesmo conteúdo, e a consulta roda com os
 * privilégios de `anon`, que não alcançam `property_private` nem `contacts`.
 * Se um dia alguém adicionar um join indevido aqui, o banco recusa — não é o
 * código desta função que segura a regra.
 */
export async function listPublicProperties(
  filters: PropertyFilters & { limit?: number; offset?: number } = {},
): Promise<PublicProperty[]> {
  const supabase = createAnonClient();
  const limit = filters.limit ?? 24;
  const offset = filters.offset ?? 0;

  let query = supabase
    .from("properties")
    .select(PUBLIC_PROPERTY_COLUMNS)
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (filters.type) query = query.eq("type", filters.type as PropertyType);
  if (filters.purpose) query = query.eq("purpose", filters.purpose as PropertyPurpose);
  if (filters.bedrooms) query = query.gte("bedrooms", filters.bedrooms);
  if (filters.saleBand) query = query.eq("sale_band", filters.saleBand);
  if (filters.rentBand) query = query.eq("rent_band", filters.rentBand);
  // O texto vai dentro da sintaxe de filtro do PostgREST: vírgula, parêntese e
  // ponto mudariam a consulta. Fica só letra, número, espaço e hífen.
  const q = filters.q?.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
  if (q) {
    const term = `%${q}%`;
    query = query.or(
      `city.ilike.${term},neighborhood.ilike.${term},title.ilike.${term}`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao listar imóveis: ${error.message}`);
  return (data ?? []) as unknown as PublicProperty[];
}

/**
 * Capa de cada imóvel (a marcada como capa, ou a primeira foto).
 *
 * Cliente anônimo de novo: a policy de property_media só devolve mídia de
 * imóvel publicado, então um id de rascunho aqui simplesmente não tem capa.
 */
export async function listCovers(ids: string[]): Promise<Map<string, string>> {
  const covers = new Map<string, string>();
  if (!ids.length) return covers;
  const { data, error } = await createAnonClient()
    .from("property_media")
    .select("property_id, storage_path, is_cover, position")
    .in("property_id", ids)
    .eq("kind", "foto")
    .order("is_cover", { ascending: false })
    .order("position");
  if (error) return covers;
  for (const m of data ?? []) {
    if (!covers.has(m.property_id)) covers.set(m.property_id, mediaUrl(m.storage_path));
  }
  return covers;
}

/** Fotos e vídeos de um imóvel publicado, na ordem da galeria. */
export async function listPublicMedia(
  propertyId: string,
): Promise<{ id: string; kind: "foto" | "video"; url: string }[]> {
  const { data } = await createAnonClient()
    .from("property_media")
    .select("id, kind, storage_path, is_cover, position")
    .eq("property_id", propertyId)
    .order("is_cover", { ascending: false })
    .order("position");
  return (data ?? []).map((m) => ({ id: m.id, kind: m.kind, url: mediaUrl(m.storage_path) }));
}

/** Contato do atendimento (o Master). Público: é para onde o TENHO INTERESSE leva. */
export async function getContactSettings(): Promise<{ whatsapp: string; email: string }> {
  const { data } = await createAnonClient()
    .from("site_settings")
    .select("master_whatsapp, master_email")
    .maybeSingle();
  return { whatsapp: data?.master_whatsapp ?? "", email: data?.master_email ?? "" };
}

/** Um imóvel pelo código público (IMB-00123). */
export async function getPublicProperty(code: string): Promise<PublicProperty | null> {
  const supabase = createAnonClient();

  const { data, error } = await supabase
    .from("properties")
    .select(PUBLIC_PROPERTY_COLUMNS)
    .eq("code", code)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar o imóvel: ${error.message}`);
  return (data as unknown as PublicProperty) ?? null;
}
