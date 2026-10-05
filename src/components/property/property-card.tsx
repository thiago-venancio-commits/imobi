import { Bath, BedDouble, Car, Mail, Maximize } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { area, bandLabel, type PublicProperty, typeLabel } from "@/lib/properties";
import { cn } from "@/lib/utils";

/**
 * Card do imóvel na vitrine.
 *
 * Recebe só `PublicProperty`, que é a linha da tabela pública. Não existe
 * prop de preço aqui — nem haveria de onde tirar uma: o valor mora em
 * `property_private`, fora do alcance de anon e do comprador.
 */
export function PropertyCard({ property }: { property: PublicProperty }) {
  const isRent = property.purpose === "locacao";
  const band = bandLabel(property.purpose, property.sale_band, property.rent_band);

  const specs = [
    property.bedrooms > 0 && { icon: BedDouble, label: `${property.bedrooms} quartos` },
    property.suites > 0 && { icon: Bath, label: `${property.suites} suítes` },
    property.parking_spaces > 0 && { icon: Car, label: `${property.parking_spaces} vagas` },
    area(property.total_area) && { icon: Maximize, label: area(property.total_area)! },
  ].filter(Boolean) as { icon: typeof BedDouble; label: string }[];

  return (
    <article className="group overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border transition-shadow hover:shadow-lg">
      <Link href={`/imoveis/${property.code}`} className="block">
        <div className="relative aspect-[4/3] bg-muted">
          {/* A foto de capa entra aqui quando houver mídia publicada. */}
          <Badge
            className={cn(
              "absolute left-3 top-3 border-0 text-white",
              isRent ? "bg-rent" : "bg-sale",
            )}
          >
            {isRent ? "Aluguel" : "Venda"}
          </Badge>
        </div>

        <div className="p-4">
          <h3 className="font-semibold leading-snug">
            {property.title || typeLabel(property.type)}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {property.neighborhood ? `${property.neighborhood} - ` : ""}
            {property.city}
            {property.state ? `/${property.state}` : ""}
          </p>

          {specs.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              {specs.map((spec) => (
                <li key={spec.label} className="flex items-center gap-1.5">
                  <spec.icon className="size-3.5" aria-hidden />
                  {spec.label}
                </li>
              ))}
            </ul>
          ) : null}

          {/*
            Faixa de preço (emenda E1), nunca o valor. O comprador descobre a
            ordem de grandeza para filtrar a busca; quanto o proprietário pede,
            qual o mínimo que aceita e qual a margem continuam na intermediação.
          */}
          {band ? <p className="mt-3 text-sm font-medium text-brand-500">{band}</p> : null}

          <p className="mt-3 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground">
            <Mail className="size-3.5 shrink-0" aria-hidden />
            Entre em contato para saber o valor
          </p>
        </div>
      </Link>
    </article>
  );
}
