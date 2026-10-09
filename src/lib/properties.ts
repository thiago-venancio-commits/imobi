import { publicEnv } from "@/lib/env";
import type { Database, PropertyStatus } from "@/lib/supabase/database.types";

export type SaleBand = "ate_300k" | "de_300k_600k" | "de_600k_1mi" | "acima_1mi";
export type RentBand = "ate_2k" | "de_2k_5k" | "de_5k_10k" | "acima_10k";

/**
 * Rótulos das faixas de preço (emenda E1 da spec).
 *
 * A faixa é a ÚNICA informação de valor que chega ao comprador. O valor
 * pedido, o mínimo aceitável e a margem continuam em `property_private`, que
 * nem anon nem comprador conseguem ler. Por isso o card nunca mostra número:
 * mostra a faixa e "Entre em contato para saber o valor".
 */
export const SALE_BANDS: { value: SaleBand; label: string }[] = [
  { value: "ate_300k", label: "Até R$ 300 mil" },
  { value: "de_300k_600k", label: "R$ 300 mil a R$ 600 mil" },
  { value: "de_600k_1mi", label: "R$ 600 mil a R$ 1 milhão" },
  { value: "acima_1mi", label: "Acima de R$ 1 milhão" },
];

export const RENT_BANDS: { value: RentBand; label: string }[] = [
  { value: "ate_2k", label: "Até R$ 2 mil" },
  { value: "de_2k_5k", label: "R$ 2 mil a R$ 5 mil" },
  { value: "de_5k_10k", label: "R$ 5 mil a R$ 10 mil" },
  { value: "acima_10k", label: "Acima de R$ 10 mil" },
];

export const PROPERTY_TYPES = [
  { value: "casa", label: "Casa", plural: "Casas" },
  { value: "apartamento", label: "Apartamento", plural: "Apartamentos" },
  { value: "cobertura", label: "Cobertura", plural: "Coberturas" },
  { value: "lote", label: "Lote", plural: "Lotes" },
  { value: "terreno", label: "Terreno", plural: "Terrenos" },
  { value: "comercial", label: "Comercial", plural: "Comerciais" },
  { value: "sala", label: "Sala", plural: "Salas" },
  { value: "loja", label: "Loja", plural: "Lojas" },
  { value: "galpao", label: "Galpão", plural: "Galpões" },
  { value: "sitio", label: "Sítio", plural: "Sítios" },
  { value: "fazenda", label: "Fazenda", plural: "Fazendas" },
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number]["value"];

export function typeLabel(value: string): string {
  return PROPERTY_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function bandLabel(
  purpose: string,
  saleBand: SaleBand | null,
  rentBand: RentBand | null,
): string | null {
  if (purpose !== "locacao" && saleBand) {
    return SALE_BANDS.find((b) => b.value === saleBand)?.label ?? null;
  }
  if (rentBand) {
    return RENT_BANDS.find((b) => b.value === rentBand)?.label ?? null;
  }
  return null;
}

export function purposeLabel(purpose: string): string {
  if (purpose === "locacao") return "Aluguel";
  if (purpose === "venda_locacao") return "Venda ou aluguel";
  return "Venda";
}

export const PROPERTY_PURPOSES = [
  { value: "venda", label: "Venda" },
  { value: "locacao", label: "Aluguel" },
  { value: "venda_locacao", label: "Venda ou aluguel" },
] as const;

export const PROPERTY_CONDITIONS = [
  { value: "usado", label: "Usado" },
  { value: "novo", label: "Novo" },
  { value: "lancamento", label: "Lançamento" },
] as const;

/** §27, mais o rascunho (0006). */
export const STATUS_LABELS: Record<PropertyStatus, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  publicado: "Publicado",
  reservado: "Reservado",
  em_negociacao: "Em negociação",
  vendido: "Vendido",
  alugado: "Alugado",
  // No banco é "pausado"; para o Master e o dono é o bloqueio (0009).
  pausado: "Bloqueado",
  rejeitado: "Rejeitado",
  cancelado: "Cancelado",
};

/** Mesma lista de private.property_is_public(): o que aparece no site. */
export const PUBLIC_STATUSES: PropertyStatus[] = ["publicado", "reservado", "em_negociacao"];

/**
 * O dono pode enviar para aprovação a partir destes status. "pausado" (bloqueado
 * pelo Master) não está aqui: só o Master desbloqueia (trigger da 0009).
 */
export const SUBMITTABLE_STATUSES: PropertyStatus[] = ["rascunho", "rejeitado"];

/**
 * URL pública de uma mídia do bucket `property-media`. Só serve a cópia LIMPA:
 * o original com GPS está no bucket privado e não tem URL pública.
 */
export function mediaUrl(path: string): string {
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/property-media/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/**
 * Valor em reais digitado à brasileira: "650.000", "650.000,50", "R$ 1.200".
 * Devolve null para vazio e NaN para lixo, para o schema poder distinguir.
 */
export function parseBRL(input: string): number | null {
  const raw = input.replace(/[^\d.,]/g, "");
  if (!raw) return null;
  let normalized: string;
  if (raw.includes(",")) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, "");
  } else {
    normalized = raw;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function formatBRL(value: number | string | null): string {
  if (value === null || value === "") return "";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

/** Área formatada em m², sem casas decimais inúteis. */
export function area(value: number | string | null): string | null {
  if (value === null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n)} m²`;
}

/**
 * Colunas públicas do imóvel. Esta lista é a fronteira: tudo que está aqui
 * pode ir para o navegador. Preço, endereço e dono não estão nesta tabela,
 * então não há como incluí-los por engano.
 */
export const PUBLIC_PROPERTY_COLUMNS =
  "id, code, type, purpose, condition, in_condominium, title, description, " +
  "features, amenities, bedrooms, suites, bathrooms, parking_spaces, " +
  "total_area, built_area, land_area, condo_fee, city, state, neighborhood, " +
  "approx_lat, approx_lng, location_precision, landmarks, status, " +
  "sale_band, rent_band, published_at, views_count";

export type PublicProperty = Pick<
  Database["public"]["Tables"]["properties"]["Row"],
  | "id"
  | "code"
  | "type"
  | "purpose"
  | "condition"
  | "in_condominium"
  | "title"
  | "description"
  | "features"
  | "amenities"
  | "bedrooms"
  | "suites"
  | "bathrooms"
  | "parking_spaces"
  | "total_area"
  | "built_area"
  | "land_area"
  | "condo_fee"
  | "city"
  | "state"
  | "neighborhood"
  | "approx_lat"
  | "approx_lng"
  | "location_precision"
  | "landmarks"
  | "status"
  | "sale_band"
  | "rent_band"
  | "published_at"
  | "views_count"
>;

export interface PropertyFilters {
  q?: string;
  type?: string;
  purpose?: string;
  bedrooms?: number;
  saleBand?: SaleBand;
  rentBand?: RentBand;
}
