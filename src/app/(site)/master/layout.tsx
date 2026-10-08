import type { Metadata } from "next";
import Link from "next/link";

import { requireMasterPage } from "@/lib/server/page-guards";

export const metadata: Metadata = {
  title: { default: "Painel Master", template: "%s · Master · TSV Imóveis" },
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/master", label: "Painel" },
  { href: "/master/imoveis", label: "Imóveis" },
  { href: "/master/proprietarios", label: "Proprietários" },
  { href: "/master/configuracoes", label: "Configurações" },
];

export default async function MasterLayout({ children }: LayoutProps<"/master">) {
  await requireMasterPage();

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[12rem_1fr]">
      <nav aria-label="Painel Master" className="flex gap-1 overflow-x-auto lg:flex-col">
        <p className="hidden px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:block">
          Master
        </p>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
