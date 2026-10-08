import { Bath, BedDouble, Car, Check, Lock, MapPin, Maximize, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";

import { MarketBadge } from "@/components/property/market-badge";
import { Button } from "@/components/ui/button";
import { area, bandLabel, formatBRL, PROPERTY_CONDITIONS, purposeLabel, typeLabel } from "@/lib/properties";
import { createAnonClient } from "@/lib/supabase/server";
import { getContactSettings, getPublicProperty, listPublicMedia } from "@/lib/server/properties";

export const dynamic = "force-dynamic";

/*
 * Página pública do imóvel (§6).
 *
 * Tudo aqui é lido com o cliente ANÔNIMO, da metade pública do imóvel. Não há
 * preço nem endereço para vazar no HTML ou no payload RSC: eles moram em
 * property_private, que anon não lê. O mapa usa a coordenada que o banco já
 * deslocou; a exata nunca sai de lá.
 */

const CODE = /^IMB-\d{5,}$/;

const load = cache(async (code: string) => {
  if (!CODE.test(code)) return null;
  const property = await getPublicProperty(code);
  if (!property) return null;
  const media = await listPublicMedia(property.id);
  return { property, media };
});

export async function generateMetadata({ params }: PageProps<"/imoveis/[code]">): Promise<Metadata> {
  const { code } = await params;
  const data = await load(code);
  if (!data) return { title: "Imóvel não encontrado" };
  const { property: p, media } = data;
  const where = [p.neighborhood, p.city].filter(Boolean).join(", ");
  const title = `${p.title || typeLabel(p.type)}${where ? ` · ${where}` : ""}`;
  const description = (p.description || `${typeLabel(p.type)} para ${purposeLabel(p.purpose).toLowerCase()} em ${where}.`).slice(0, 160);
  const cover = media.find((m) => m.kind === "foto");
  return {
    title,
    description,
    alternates: { canonical: `/imoveis/${p.code}` },
    // A prévia do link no WhatsApp usa estas tags: foto de capa + título.
    openGraph: { title, description, type: "website", images: cover ? [{ url: cover.url }] : undefined },
  };
}

export default async function PropertyPage({ params }: PageProps<"/imoveis/[code]">) {
  const { code } = await params;
  const data = await load(code);
  if (!data) notFound();
  const { property: p, media } = data;
  const contact = await getContactSettings();

  // Contador de visualizações (§33), depois que a resposta saiu: não segura a
  // página. O builder do Supabase só dispara a requisição quando é aguardado.
  after(async () => {
    await createAnonClient().rpc("register_property_view", { _property: p.id });
  });

  const band = bandLabel(p.purpose, p.sale_band, p.rent_band);
  const where = [p.neighborhood, p.city && `${p.city}/${p.state}`].filter(Boolean).join(", ");
  const specs = [
    p.bedrooms > 0 && { icon: BedDouble, label: `${p.bedrooms} quarto${p.bedrooms > 1 ? "s" : ""}` },
    p.suites > 0 && { icon: Bath, label: `${p.suites} suíte${p.suites > 1 ? "s" : ""}` },
    p.bathrooms > 0 && { icon: Bath, label: `${p.bathrooms} banheiro${p.bathrooms > 1 ? "s" : ""}` },
    p.parking_spaces > 0 && { icon: Car, label: `${p.parking_spaces} vaga${p.parking_spaces > 1 ? "s" : ""}` },
    area(p.total_area) && { icon: Maximize, label: `${area(p.total_area)} total` },
    area(p.built_area) && { icon: Maximize, label: `${area(p.built_area)} construída` },
    area(p.land_area) && { icon: Maximize, label: `${area(p.land_area)} de terreno` },
  ].filter(Boolean) as { icon: typeof BedDouble; label: string }[];

  // TENHO INTERESSE leva SEMPRE ao atendimento da TSV, nunca ao proprietário
  // (§3, §41). Os leads de verdade, com distribuição a corretores, vêm no M4.
  const message = `Olá! Tenho interesse no imóvel ${p.code} (${p.title || typeLabel(p.type)}).`;
  const interestHref = contact.whatsapp
    ? `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`
    : contact.email
      ? `mailto:${contact.email}?subject=${encodeURIComponent(`Interesse no ${p.code}`)}&body=${encodeURIComponent(message)}`
      : null;

  const showMap = p.location_precision !== "bairro" && p.approx_lat !== null && p.approx_lng !== null;
  const d = 0.008; // ~900 m de cada lado: mostra a região, não a rua
  const mapSrc = showMap
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${p.approx_lng! - d},${p.approx_lat! - d},${p.approx_lng! + d},${p.approx_lat! + d}&layer=mapnik`
    : null;

  const [first, ...rest] = media;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="text-sm text-muted-foreground">
        <Link href="/imoveis" className="hover:underline">
          Imóveis
        </Link>{" "}
        / <span>{p.code}</span>
      </nav>

      {/* Galeria ------------------------------------------------------------ */}
      {first ? (
        <div className={`mt-4 grid gap-2 overflow-hidden rounded-2xl ${rest.length ? "md:grid-cols-[2fr_1fr]" : ""}`}>
          <div className={`relative bg-muted ${rest.length ? "aspect-[4/3] md:aspect-auto md:min-h-[26rem]" : "aspect-[16/9] max-h-[32rem]"}`}>
            {first.kind === "foto" ? (
              <Image src={first.url} alt={p.title || typeLabel(p.type)} fill priority sizes="(min-width: 768px) 66vw, 100vw" className="object-cover" />
            ) : (
              <video src={first.url} controls preload="metadata" className="size-full object-cover" />
            )}
          </div>
          {rest.length ? (
            <ul className="flex snap-x gap-2 overflow-x-auto md:grid md:max-h-[26rem] md:grid-cols-2 md:overflow-y-auto">
              {rest.map((m) => (
                <li key={m.id} className="relative aspect-[4/3] w-48 shrink-0 snap-start bg-muted md:w-auto">
                  {m.kind === "foto" ? (
                    <a href={m.url} target="_blank" rel="noreferrer">
                      <Image src={m.url} alt="" fill sizes="(min-width: 768px) 16vw, 12rem" className="object-cover" />
                    </a>
                  ) : (
                    <video src={m.url} controls preload="metadata" className="size-full object-cover" />
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <header>
            <p className="text-sm font-medium text-brand-500">
              {typeLabel(p.type)} · {purposeLabel(p.purpose)} ·{" "}
              {PROPERTY_CONDITIONS.find((c) => c.value === p.condition)?.label}
              {p.in_condominium ? " · em condomínio" : ""}
            </p>
            <MarketBadge status={p.status} className="mt-2" />
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{p.title || typeLabel(p.type)}</h1>
            {where ? (
              <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-4" aria-hidden />
                {where}
              </p>
            ) : null}
          </header>

          {specs.length ? (
            <ul className="flex flex-wrap gap-3">
              {specs.map((s) => (
                <li key={s.label} className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-border">
                  <s.icon className="size-4 text-brand-500" aria-hidden />
                  {s.label}
                </li>
              ))}
            </ul>
          ) : null}

          {p.description ? (
            <section>
              <h2 className="text-lg font-semibold">Descrição</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-foreground/90">{p.description}</p>
            </section>
          ) : null}

          {p.features.length || p.amenities.length ? (
            <section className="grid gap-6 sm:grid-cols-2">
              {[
                { title: "Características", items: p.features },
                { title: "Comodidades", items: p.amenities },
              ]
                .filter((g) => g.items.length)
                .map((g) => (
                  <div key={g.title}>
                    <h2 className="text-lg font-semibold">{g.title}</h2>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {g.items.map((it) => (
                        <li key={it} className="flex items-center gap-2">
                          <Check className="size-4 text-emerald-600" aria-hidden />
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </section>
          ) : null}

          <section>
            <h2 className="text-lg font-semibold">Localização</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {where}
              {p.landmarks ? ` · ${p.landmarks}` : ""}. O endereço exato é informado pela equipe no atendimento.
            </p>
            {mapSrc ? (
              <iframe
                title={`Região aproximada do imóvel ${p.code}`}
                src={mapSrc}
                loading="lazy"
                className="mt-3 h-72 w-full rounded-2xl ring-1 ring-border"
              />
            ) : null}
          </section>
        </div>

        {/* Área comercial (§6): sem preço, com TENHO INTERESSE ------------- */}
        <aside className="h-fit rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border lg:sticky lg:top-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor</p>
          <p className="mt-1 text-2xl font-extrabold">Sob consulta</p>
          {band ? <p className="mt-1 text-sm font-medium text-brand-500">Faixa: {band}</p> : null}
          {p.condo_fee ? (
            <p className="mt-1 text-sm text-muted-foreground">Condomínio: {formatBRL(p.condo_fee)}/mês</p>
          ) : null}
          {p.status === "em_negociacao" || p.status === "reservado" ? (
            <p className="mt-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-950">
              <strong>{p.status === "reservado" ? "Este imóvel está reservado." : "Este imóvel já está em negociação."}</strong>{" "}
              Demonstre interesse agora: se o negócio não se fechar, você é o próximo a ser chamado.
            </p>
          ) : null}
          <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            Tenha acesso às condições comerciais falando com a nossa equipe. Atendimento sem compromisso.
          </p>
          {interestHref ? (
            <Button
              size="lg"
              className="mt-5 h-12 w-full gap-2 text-base font-bold"
              nativeButton={false}
              render={<a href={interestHref} target="_blank" rel="noreferrer" />}
            >
              <MessageCircle className="size-5" aria-hidden />
              TENHO INTERESSE
            </Button>
          ) : (
            <p className="mt-5 rounded-lg bg-secondary px-3 py-2 text-sm">Atendimento disponível em breve.</p>
          )}
          <p className="mt-3 text-center text-xs text-muted-foreground">Código do imóvel: {p.code}</p>
        </aside>
      </div>
    </div>
  );
}
