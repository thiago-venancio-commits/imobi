import type { Metadata } from "next";
import Link from "next/link";

import { requireOwnerPage } from "@/lib/server/page-guards";

export const metadata: Metadata = {
  title: { default: "Meus imóveis", template: "%s · Proprietário · TSV Imóveis" },
  robots: { index: false, follow: false },
};

export default async function OwnerLayout({ children }: LayoutProps<"/proprietario">) {
  const caller = await requireOwnerPage();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/proprietario" className="text-sm font-semibold text-brand-500 hover:underline">
          Área do proprietário
        </Link>
        <Link href="/minha-conta" className="text-sm text-muted-foreground hover:underline">
          Minha conta
        </Link>
      </div>

      {caller.ownerStatus === "pendente" ? (
        <p role="status" className="mb-6 rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          <strong>Seu cadastro de proprietário está em análise.</strong> Você já pode cadastrar e enviar
          imóveis; eles vão ao ar depois que a equipe aprovar o seu cadastro e o anúncio.
        </p>
      ) : null}

      {children}
    </div>
  );
}
