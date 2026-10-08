import Link from "next/link";

import { cn } from "@/lib/utils";

/** Abas por status como links (?status=...): funcionam sem JS e dão URL compartilhável. */
export function StatusTabs({
  base,
  current,
  tabs,
}: {
  base: string;
  current: string;
  tabs: { value: string; label: string; count?: number }[];
}) {
  return (
    <nav aria-label="Filtrar por status" className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => {
        const active = t.value === current;
        return (
          <Link
            key={t.value}
            href={`${base}?status=${t.value}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
              active ? "border-brand-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count !== undefined ? <span className="ml-1.5 text-xs text-muted-foreground">{t.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function formatPhone(digits: string | null): string {
  if (!digits) return "";
  const d = digits.replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}
