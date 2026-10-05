import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PROPERTY_TYPES, RENT_BANDS, SALE_BANDS } from "@/lib/properties";

/**
 * Busca pública.
 *
 * O campo de valor oferece FAIXAS FIXAS, nunca mínimo e máximo livres
 * (emenda E1 da spec). Qualquer filtro por preço é um oráculo de preço; com
 * faixa livre, meia dúzia de buscas chega ao valor quase exato de cada imóvel.
 * Com quatro faixas largas, o visitante aprende só a ordem de grandeza.
 *
 * É um `<form method="get">`: funciona sem JavaScript e deixa o resultado num
 * link que dá para compartilhar.
 */
export function PropertySearch({
  defaults,
}: {
  defaults?: { q?: string; type?: string; bedrooms?: string; band?: string };
}) {
  const field =
    "h-12 w-full rounded-lg border-0 bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <form
      action="/imoveis"
      method="get"
      className="grid gap-px overflow-hidden rounded-2xl bg-border shadow-xl sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]"
    >
      <label className="flex items-center gap-2 bg-card px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">Cidade, bairro ou região</span>
        <input
          type="search"
          name="q"
          defaultValue={defaults?.q}
          placeholder="Digite cidade, bairro ou região"
          className={field}
        />
      </label>

      <label className="bg-card px-3">
        <span className="sr-only">Tipo de imóvel</span>
        <select name="type" defaultValue={defaults?.type ?? ""} className={field}>
          <option value="">Tipo de imóvel: todos</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="bg-card px-3">
        <span className="sr-only">Quartos</span>
        <select name="bedrooms" defaultValue={defaults?.bedrooms ?? ""} className={field}>
          <option value="">Quartos: todos</option>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
              {n === 4 ? "+" : ""} quarto{n > 1 ? "s" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="bg-card px-3">
        <span className="sr-only">Faixa de valor</span>
        <select name="band" defaultValue={defaults?.band ?? ""} className={field}>
          <option value="">Faixa de valor (opcional)</option>
          <optgroup label="Comprar">
            {SALE_BANDS.map((b) => (
              <option key={b.value} value={`v:${b.value}`}>
                {b.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Alugar">
            {RENT_BANDS.map((b) => (
              <option key={b.value} value={`l:${b.value}`}>
                {b.label}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <div className="bg-card p-2">
        <Button type="submit" size="lg" className="h-12 w-full gap-2 px-6">
          <Search className="size-4" aria-hidden />
          Buscar
        </Button>
      </div>
    </form>
  );
}
