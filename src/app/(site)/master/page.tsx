import Link from "next/link";

import { requireMasterPage } from "@/lib/server/page-guards";

export default async function MasterHomePage() {
  const caller = await requireMasterPage();
  const db = caller.supabase;

  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [pendingOwners, awaiting, published, drafts, settings] = await Promise.all([
    count(db.from("owner_profiles").select("*", { count: "exact", head: true }).eq("status", "pendente")),
    count(db.from("properties").select("*", { count: "exact", head: true }).eq("status", "aguardando_aprovacao")),
    count(db.from("properties").select("*", { count: "exact", head: true }).eq("status", "publicado")),
    count(db.from("properties").select("*", { count: "exact", head: true }).eq("status", "rascunho")),
    db.from("site_settings").select("master_whatsapp").maybeSingle(),
  ]);

  const cards = [
    { label: "Imóveis aguardando aprovação", value: awaiting, href: "/master/imoveis?status=aguardando_aprovacao", urgent: awaiting > 0 },
    { label: "Proprietários aguardando aprovação", value: pendingOwners, href: "/master/proprietarios?status=pendente", urgent: pendingOwners > 0 },
    { label: "Imóveis publicados", value: published, href: "/master/imoveis?status=publicado" },
    { label: "Rascunhos de proprietários", value: drafts, href: "/master/imoveis?status=rascunho" },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold">Painel</h1>
      {!settings.data?.master_whatsapp ? (
        <p className="mt-4 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-950">
          O botão <strong>TENHO INTERESSE</strong> dos anúncios ainda não tem número de WhatsApp.{" "}
          <Link href="/master/configuracoes" className="font-medium underline">
            Configurar agora
          </Link>
        </p>
      ) : null}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <li key={c.label}>
            <Link
              href={c.href}
              className="block rounded-2xl bg-card p-5 ring-1 ring-border transition-colors hover:bg-accent"
            >
              <p className={c.urgent ? "text-3xl font-bold text-brand-500" : "text-3xl font-bold"}>{c.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{c.label}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
