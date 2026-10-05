import "server-only";

import { createAnonClient } from "@/lib/supabase/server";
import {
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
  filters: PropertyFilters & { limit?: number } = {},
): Promise<PublicProperty[]> {
  const supabase = createAnonClient();

  let query = supabase
    .from("properties")
    .select(PUBLIC_PROPERTY_COLUMNS)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(filters.limit ?? 24);

  if (filters.type) query = query.eq("type", filters.type as PropertyType);
  if (filters.purpose) query = query.eq("purpose", filters.purpose as PropertyPurpose);
  if (filters.bedrooms) query = query.gte("bedrooms", filters.bedrooms);
  if (filters.saleBand) query = query.eq("sale_band", filters.saleBand);
  if (filters.rentBand) query = query.eq("rent_band", filters.rentBand);
  if (filters.q) {
    const term = `%${filters.q}%`;
    query = query.or(
      `city.ilike.${term},neighborhood.ilike.${term},title.ilike.${term}`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao listar imóveis: ${error.message}`);
  return (data ?? []) as unknown as PublicProperty[];
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
