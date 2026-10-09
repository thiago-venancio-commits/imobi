import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { formatDate, StatusTabs } from "@/components/master/status-tabs";
import { StatusBadge } from "@/components/property/status-badge";
import { formatBRL, mediaUrl, purposeLabel, STATUS_LABELS, typeLabel } from "@/lib/properties";
import { requireMasterPage } from "@/lib/server/page-guards";
import type { PropertyStatus } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Imóveis" };

const TABS: { value: PropertyStatus | "todos"; label: string }[] = [
  { value: "aguardando_aprovacao", label: STATUS_LABELS.aguardando_aprovacao },
  { value: "publicado", label: "Publicados" },
  { value: "rascunho", label: "Rascunhos" },
  { value: "rejeitado", label: "Rejeitados" },
  { value: "pausado", label: "Bloqueados" },
  { value: "todos", label: "Todos" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MasterPropertiesPage({ searchParams }: PageProps<"/master/imoveis">) {
  const caller = await requireMasterPage("/master/imoveis");
  const { status: raw, owner } = await searchParams;
  const status = TABS.find((t) => t.value === raw)?.value ?? "aguardando_aprovacao";
  const ownerId = typeof owner === "string" && UUID.test(owner) ? owner : null;

  let query = caller.supabase
    .from("properties")
    .select(
      "id, code, title, type, purpose, city, state, neighborhood, status, updated_at, property_private!inner(owner_id, price_sale, price_rent), property_media(storage_path, is_cover, kind)",
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  if (status !== "todos") query = query.eq("status", status);
  if (ownerId) query = query.eq("property_private.owner_id", ownerId);
  const { data: rows } = await query;

  const ownerIds = [...new Set((rows ?? []).map((r) => r.property_private.owner_id))];
  const [{ data: profiles }, { data: owners }] = await Promise.all([
    ownerIds.length
      ? caller.supabase.from("profiles").select("id, full_name").in("id", ownerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    ownerIds.length
      ? caller.supabase.from("owner_profiles").select("user_id, status").in("user_id", ownerIds)
      : Promise.resolve({ data: [] as { user_id: string; status: string }[] }),
  ]);
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const ownerStatusOf = new Map((owners ?? []).map((o) => [o.user_id, o.status]));

  return (
    <>
      <h1 className="text-2xl font-bold">Imóveis</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        Revise antes de publicar: textos, fotos e se a localização das fotos bate com o endereço.
      </p>
      <StatusTabs base="/master/imoveis" current={status} tabs={TABS} />

      {!rows?.length ? (
        <p className="mt-6 rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-border">
          Nenhum imóvel nesta lista.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((p) => {
            const cover = p.property_media.find((m) => m.is_cover) ?? p.property_media.find((m) => m.kind === "foto");
            const price = p.purpose === "locacao" ? p.property_private.price_rent : p.property_private.price_sale;
            const ownerPending = ownerStatusOf.get(p.property_private.owner_id) !== "aprovado";
            return (
              <li key={p.id}>
                <Link
                  href={`/master/imoveis/${p.id}`}
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
                      {ownerPending ? (
                        <span className="text-xs font-medium text-amber-700">proprietário não aprovado</span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate font-semibold">{p.title || typeLabel(p.type)}</p>
                    <p className="text-sm text-muted-foreground">
                      {typeLabel(p.type)} · {purposeLabel(p.purpose)} · {p.neighborhood || "sem bairro"}
                      {p.city ? `, ${p.city}/${p.state}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {nameOf.get(p.property_private.owner_id) || "Proprietário sem nome"} · {formatBRL(price) || "sem valor"} ·
                      atualizado {formatDate(p.updated_at)}
                    </p>
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
