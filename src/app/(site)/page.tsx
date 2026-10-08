import {
  Building2,
  Home as HomeIcon,
  LandPlot,
  Store,
  Target,
  Tent,
  Trees,
} from "lucide-react";
import Link from "next/link";

import { PropertyCard } from "@/components/property/property-card";
import { PropertySearch } from "@/components/property/property-search";
import { Button } from "@/components/ui/button";
import { listCovers, listPublicProperties } from "@/lib/server/properties";

const CATEGORIES = [
  { icon: HomeIcon, label: "Casas", href: "/imoveis?type=casa" },
  { icon: Building2, label: "Apartamentos", href: "/imoveis?type=apartamento" },
  { icon: LandPlot, label: "Terrenos", href: "/imoveis?type=terreno" },
  { icon: Store, label: "Comerciais", href: "/imoveis?type=comercial" },
  { icon: Trees, label: "Rurais", href: "/imoveis?type=sitio" },
  { icon: Tent, label: "Temporada", href: "/imoveis?purpose=locacao" },
];

/*
 * Renderiza a cada requisicao. A vitrine muda quando o Master aprova ou pausa
 * um anuncio, e por enquanto nao ha projeto Supabase para prerenderizar contra.
 * Quando o projeto existir, vale trocar por ISR (`revalidate` + revalidateTag
 * no fluxo de aprovacao): a pagina publica ganha cache e o SEO melhora.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const featured = await listPublicProperties({ limit: 6 });
  const covers = await listCovers(featured.map((p) => p.id));

  return (
    <>
      {/* Hero -------------------------------------------------------------- */}
      <section className="bg-navy-950 text-white">
        <div className="mx-auto max-w-7xl px-4 pb-28 pt-12 sm:px-6 lg:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                Seu próximo imóvel
                <br />
                <span className="text-brand-400">pode estar aqui</span>
              </h1>
              <p className="mt-5 max-w-xl text-white/75">
                Conecte-se a proprietários e encontre o imóvel ideal, com
                segurança, praticidade e suporte especializado.
              </p>
            </div>

            <div className="rounded-2xl bg-navy-900/80 p-6 ring-1 ring-white/10 backdrop-blur">
              <Target className="size-8 text-brand-400" aria-hidden />
              <h2 className="mt-4 text-xl font-bold">
                Cadastre seu interesse
                <br />
                em comprar ou alugar
              </h2>
              <p className="mt-3 text-sm text-white/70">
                Informe o que procura e receba as melhores opções em seu perfil.
              </p>
              {/* Base UI compoe via `render`, nao via asChild. */}
              <Button
                size="lg"
                className="mt-5 h-12 w-full"
                render={<Link href="/procuro-imovel" />}
              >
                Quero cadastrar meu interesse
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Busca, sobreposta à faixa escura ---------------------------------- */}
      <div className="mx-auto -mt-20 max-w-7xl px-4 sm:px-6">
        <PropertySearch />
      </div>

      {/* Categorias -------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {CATEGORIES.map((c) => (
            <li key={c.label}>
              <Link
                href={c.href}
                className="flex flex-col items-center gap-2.5 rounded-2xl bg-card p-5 text-center shadow-sm ring-1 ring-border transition-colors hover:bg-accent"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-secondary text-brand-500">
                  <c.icon className="size-5" aria-hidden />
                </span>
                <span className="text-sm font-medium">{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Destaques --------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="flex items-center gap-3 text-xl font-bold">
            <span className="h-0.5 w-6 rounded bg-brand-500" aria-hidden />
            Imóveis em destaque
          </h2>
          <Link
            href="/imoveis"
            className="text-sm font-medium text-brand-500 hover:underline"
          >
            Ver todos os imóveis →
          </Link>
        </div>

        {featured.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((property) => (
              <PropertyCard key={property.id} property={property} coverUrl={covers.get(property.id)} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground ring-1 ring-border">
            Ainda não há imóveis publicados. Assim que o primeiro anúncio for
            aprovado, ele aparece aqui.
          </p>
        )}
      </section>
    </>
  );
}
