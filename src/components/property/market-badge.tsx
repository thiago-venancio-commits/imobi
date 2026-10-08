import { Flame } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Selo público de procura: "Em negociação" ou "Reservado".
 *
 * Os dois status continuam na vitrine (private.property_is_public) de
 * propósito: mostrar que um imóvel já tem negociação em andamento cria
 * urgência nos outros interessados, e quem demonstra interesse entra na fila
 * caso o negócio não se feche. Vendido e alugado saem do ar.
 */
const COPY: Record<string, string> = {
  em_negociacao: "Em negociação",
  reservado: "Reservado",
};

export function marketStatusLabel(status: string): string | null {
  return COPY[status] ?? null;
}

export function MarketBadge({ status, className }: { status: string; className?: string }) {
  const label = marketStatusLabel(status);
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white shadow",
        className,
      )}
    >
      <Flame className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
