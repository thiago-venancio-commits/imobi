import type { Metadata } from "next";
import Link from "next/link";

import { PropertyCard } from "@/components/property/property-card";
import { PropertySearch } from "@/components/property/property-search";
import {
  PROPERTY_TYPES,
  RENT_BANDS,
  type RentBand,
  SALE_BANDS,
  type SaleBand,
} from "@/lib/properties";
import { listCovers, listPublicProperties } from "@/lib/server/properties";

export const metadata: Metadata = {
  title: "Imóveis à venda e para alugar",
  description: "Casas, apartamentos, terrenos e imóveis comerciais. Fale com a equipe TSV para saber valores e condições.",
};

// A vitrine muda a cada aprovação do Master; ver a nota em (site)/page.tsx.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

function one(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export default async function PropertiesPage({ searchParams }: PageProps<"/imoveis">) {
  const sp = await searchParams;
  const q = one(sp.q).slice(0, 80);
  const type = PROPERTY_TYPES.some((t) => t.value === one(sp.type)) ? one(sp.type) : "";
  const purpose = ["venda", "locacao"].includes(one(sp.purpose)) ? one(sp.purpose) : "";
  const bedrooms = Math.min(Math.max(Number(one(sp.bedrooms)) || 0, 0), 4);
  const band = one(sp.band);
  const page = Math.max(Number(one(sp.page)) || 1, 1);

  // A faixa vem como "v:ate_300k" (venda) ou "l:ate_2k" (locação).
  const [bandKind, bandValue] = band.split(":");
  const saleBand = bandKind === "v" && SALE_BANDS.some((b) => b.value === bandValue) ? (bandValue as SaleBand) : undefined;
  const rentBand = bandKind === "l" && RENT_BANDS.some((b) => b.value === bandValue) ? (bandValue as RentBand) : undefined;

  // Pede um a mais para saber se existe próxima página sem contar a tabela.
  const results = await listPublicProperties({
    q: q || undefined,
    type: type || undefined,
    purpose: purpose || undefined,
    bedrooms: bedrooms || undefined,
    saleBand,
    rentBand,
    limit: PAGE_SIZE + 1,
    offset: (page - 1) * PAGE_SIZE,
  });
  const hasNext = results.length > PAGE_SIZE;
  const properties = results.slice(0, PAGE_SIZE);
  const covers = await listCovers(properties.map((p) => p.id));

  const link = (n: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, type, purpose, bedrooms: bedrooms ? String(bedrooms) : "", band })) {
      if (v) params.set(k, v);
    }
    if (n > 1) params.set("page", String(n));
    const s = params.toString();
    return s ? `/imoveis?${s}` : "/imoveis";
  };

  const typeTitle = PROPERTY_TYPES.find((t) => t.value === type)?.plural;

  return (
    <>
      <section className="bg-navy-950 pb-24 pt-10 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {typeTitle ?? "Imóveis"}
            {purpose === "locacao" ? " para alugar" : purpose === "venda" ? " à venda" : ""}
          </h1>
          <p className="mt-2 text-white/70">
            Valores sob consulta: a equipe TSV atende cada interessado e apresenta as condições.
          </p>
        </div>
      </section>

      <div className="mx-auto -mt-16 max-w-7xl px-4 sm:px-6">
        <PropertySearch defaults={{ q, type, bedrooms: bedrooms ? String(bedrooms) : "", band }} />
      </div>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {properties.length ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((p) => (
                <PropertyCard key={p.id} property={p} coverUrl={covers.get(p.id)} />
              ))}
            </div>
            {page > 1 || hasNext ? (
              <nav aria-label="Páginas" className="mt-10 flex items-center justify-center gap-4 text-sm">
                {page > 1 ? (
                  <Link href={link(page - 1)} className="font-medium text-brand-500 hover:underline">
                    ← Anteriores
                  </Link>
                ) : null}
                <span className="text-muted-foreground">Página {page}</span>
                {hasNext ? (
                  <Link href={link(page + 1)} className="font-medium text-brand-500 hover:underline">
                    Próximos →
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl bg-card p-10 text-center ring-1 ring-border">
            <p className="font-medium">Nenhum imóvel encontrado com esses filtros.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre o que você procura e avisamos quando aparecer algo compatível.
            </p>
            <Link href="/procuro-imovel" className="mt-3 inline-block text-sm font-medium text-brand-500 hover:underline">
              Cadastrar meu interesse →
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
