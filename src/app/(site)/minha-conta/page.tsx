import type { Metadata } from "next";
import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/server/page-guards";

export const metadata: Metadata = {
  title: "Minha conta",
  robots: { index: false, follow: false },
};

export default async function MyAccountPage() {
  const caller = await requireUser("/minha-conta");

  // Leitura com o cliente DO USUÁRIO: a RLS de profiles só devolve a linha dele.
  const { data: profile } = await caller.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", caller.userId)
    .maybeSingle();

  const name = profile?.full_name || caller.email;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Olá, {name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{caller.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {caller.isMaster ? <Badge>Administrador Master</Badge> : null}
            {caller.isBroker ? <Badge variant="secondary">Corretor autorizado</Badge> : null}
            {caller.ownerStatus === "aprovado" ? <Badge variant="secondary">Proprietário</Badge> : null}
            {caller.ownerStatus === "pendente" ? (
              <Badge variant="outline">Proprietário · aguardando aprovação</Badge>
            ) : null}
          </div>
        </div>

        <form action={signOutAction}>
          <Button type="submit" variant="outline">
            Sair
          </Button>
        </form>
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        <li className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="font-semibold">Ver imóveis</h2>
          <p className="mt-1 text-sm text-muted-foreground">Navegue pela vitrine e demonstre interesse.</p>
          <Link href="/imoveis" className="mt-3 inline-block text-sm font-medium text-brand-500 hover:underline">
            Ir para os imóveis →
          </Link>
        </li>
        <li className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="font-semibold">Anunciar meu imóvel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre seu imóvel. Nossa equipe revisa antes de publicar.
          </p>
          <Link href="/anunciar" className="mt-3 inline-block text-sm font-medium text-brand-500 hover:underline">
            Quero anunciar →
          </Link>
        </li>
      </ul>
    </div>
  );
}
