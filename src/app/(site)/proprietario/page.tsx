import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { StatusBadge } from "@/components/property/status-badge";
import { Button } from "@/components/ui/button";
import { mediaUrl, purposeLabel, typeLabel } from "@/lib/properties";
import { requireOwnerPage } from "@/lib/server/page-guards";

export default async function OwnerHomePage() {
  const caller = await requireOwnerPage();

  // Filtra pelo dono explicitamente: o Master também lê property_private
  // inteira, e aqui ele deve ver só os imóveis em nome dele.
  const { data: rows } = await caller.supabase
    .from("property_private")
    .select(
      "property_id, properties(id, code, title, type, purpose, status, rejection_reason, city, state, neighborhood, updated_at, property_media(storage_path, is_cover, kind))",
    )
    .eq("owner_id", caller.userId)
    .order("created_at", { ascending: false });

  const properties = (rows ?? []).flatMap((r) => (r.properties ? [r.properties] : []));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Meus imóveis</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe o status de cada anúncio. A equipe avisa quando houver interessados.
          </p>
        </div>
        <Button className="h-10 gap-2" nativeButton={false} render={<Link href="/proprietario/imoveis/novo" />}>
          <Plus className="size-4" aria-hidden />
          Cadastrar imóvel
        </Button>
      </div>

      {properties.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-card p-10 text-center ring-1 ring-border">
          <p className="font-medium">Você ainda não cadastrou nenhum imóvel.</p>
          <Link
            href="/proprietario/imoveis/novo"
            className="mt-2 inline-block text-sm font-medium text-brand-500 hover:underline"
          >
            Cadastrar o primeiro →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {properties.map((p) => {
            const cover = p.property_media.find((m) => m.is_cover) ?? p.property_media.find((m) => m.kind === "foto");
            return (
              <li key={p.id}>
                <Link
                  href={`/proprietario/imoveis/${p.id}`}
                  className="flex gap-4 rounded-2xl bg-card p-3 ring-1 ring-border transition-colors hover:bg-accent"
                >
                  <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {cover ? (
                      <Image src={mediaUrl(cover.storage_path)} alt="" fill sizes="112px" className="object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={p.status} />
                      <span className="text-xs text-muted-foreground">{p.code}</span>
                    </div>
                    <p className="mt-1 truncate font-semibold">{p.title || typeLabel(p.type)}</p>
                    <p className="text-sm text-muted-foreground">
                      {typeLabel(p.type)} · {purposeLabel(p.purpose)}
                      {p.city ? ` · ${p.neighborhood ? `${p.neighborhood}, ` : ""}${p.city}/${p.state}` : ""}
                    </p>
                    {p.status === "rejeitado" && p.rejection_reason ? (
                      <p className="mt-1 text-sm text-destructive">Motivo: {p.rejection_reason}</p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
