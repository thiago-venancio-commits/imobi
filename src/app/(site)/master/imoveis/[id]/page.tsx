import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { setLocationPrecisionAction } from "@/app/(site)/master/actions";
import { LocationCheck } from "@/components/master/location-check";
import { CommissionForm, StatusPanel } from "@/components/master/review-forms";
import { formatDate, formatPhone } from "@/components/master/status-tabs";
import { StatusBadge } from "@/components/property/status-badge";
import { Button } from "@/components/ui/button";
import { area, formatBRL, mediaUrl, PROPERTY_CONDITIONS, PUBLIC_STATUSES, purposeLabel, typeLabel } from "@/lib/properties";
import { requireMasterPage } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Revisar imóvel" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children || "—"}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function MasterPropertyPage({ params }: PageProps<"/master/imoveis/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const caller = await requireMasterPage(`/master/imoveis/${id}`);
  const db = caller.supabase;

  const [{ data: p }, { data: priv }, { data: media }, { data: docs }] = await Promise.all([
    db.from("properties").select("*").eq("id", id).maybeSingle(),
    db.from("property_private").select("*").eq("property_id", id).maybeSingle(),
    db
      .from("property_media")
      .select("id, kind, storage_path, is_cover, position, property_media_originals(storage_path)")
      .eq("property_id", id)
      .order("position"),
    db.from("property_documents").select("id, label, storage_path").eq("property_id", id).order("created_at"),
  ]);
  if (!p || !priv) notFound();

  const [{ data: ownerRows }, originals, documents] = await Promise.all([
    db.rpc("master_owners", { _user: priv.owner_id }),
    signed(db, (media ?? []).map((m) => m.property_media_originals?.[0]?.storage_path ?? "")),
    signed(db, (docs ?? []).map((d) => d.storage_path)),
  ]);
  const owner = ownerRows?.[0];
  const ownerApproved = owner?.status === "aprovado";
  const isPublic = PUBLIC_STATUSES.includes(p.status);

  return (
    <>
      <Link href="/master/imoveis" className="text-sm text-muted-foreground hover:underline">
        ← Imóveis
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{p.title || typeLabel(p.type)}</h1>
        <StatusBadge status={p.status} />
        <span className="text-sm text-muted-foreground">{p.code}</span>
        {isPublic ? (
          <Link href={`/imoveis/${p.code}`} className="text-sm font-medium text-brand-500 hover:underline">
            Ver anúncio →
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card title={`Fotos e vídeos (${media?.length ?? 0})`}>
            {media?.length ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {media.map((m) => (
                  <li key={m.id} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                    {m.kind === "foto" ? (
                      <Image src={mediaUrl(m.storage_path)} alt="" fill sizes="240px" className="object-cover" />
                    ) : (
                      <video src={mediaUrl(m.storage_path)} controls preload="metadata" className="size-full object-cover" />
                    )}
                    {m.is_cover ? (
                      <span className="absolute left-2 top-2 rounded-md bg-brand-500 px-2 py-0.5 text-xs text-white">Capa</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma mídia.</p>
            )}
            <div className="mt-4 border-t border-border pt-4">
              <h3 className="mb-2 text-sm font-semibold">Prova de localização</h3>
              <LocationCheck
                address={priv.exact_lat !== null && priv.exact_lng !== null ? { lat: priv.exact_lat, lng: priv.exact_lng } : null}
                items={(media ?? []).map((m, i) => ({
                  id: m.id,
                  kind: m.kind,
                  label: `${m.kind === "foto" ? "Foto" : "Vídeo"} ${i + 1}`,
                  url: originals[i],
                }))}
              />
            </div>
          </Card>

          <Card title="Anúncio (o que o público vê)">
            <dl className="divide-y divide-border">
              <Row label="Tipo">{`${typeLabel(p.type)} · ${purposeLabel(p.purpose)} · ${PROPERTY_CONDITIONS.find((c) => c.value === p.condition)?.label ?? p.condition}${p.in_condominium ? " · em condomínio" : ""}`}</Row>
              <Row label="Local">{[p.neighborhood, p.city && `${p.city}/${p.state}`].filter(Boolean).join(", ")}</Row>
              <Row label="Referências">{p.landmarks}</Row>
              <Row label="Medidas">
                {[
                  `${p.bedrooms} quartos`,
                  `${p.suites} suítes`,
                  `${p.bathrooms} banheiros`,
                  `${p.parking_spaces} vagas`,
                  area(p.total_area) && `total ${area(p.total_area)}`,
                  area(p.built_area) && `construída ${area(p.built_area)}`,
                  area(p.land_area) && `terreno ${area(p.land_area)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Row>
              <Row label="Condomínio">{formatBRL(p.condo_fee)}</Row>
              <Row label="Características">{p.features.join(", ")}</Row>
              <Row label="Comodidades">{p.amenities.join(", ")}</Row>
              <Row label="Descrição">
                <span className="whitespace-pre-line">{p.description}</span>
              </Row>
            </dl>
          </Card>

          <Card title="Dados internos (nunca públicos)">
            <dl className="divide-y divide-border">
              <Row label="Endereço">
                {[priv.address, priv.street_number, priv.complement].filter(Boolean).join(", ")}
                {priv.cep ? ` · CEP ${priv.cep}` : ""}
              </Row>
              <Row label="Venda">{formatBRL(priv.price_sale)}</Row>
              <Row label="Aluguel">{formatBRL(priv.price_rent)}</Row>
              <Row label="Mínimo aceito">{formatBRL(priv.min_price)}</Row>
              <Row label="Entrada">{formatBRL(priv.down_payment)}</Row>
              <Row label="Condições">
                {[
                  priv.accepts_financing ? "aceita financiamento" : "não aceita financiamento",
                  priv.accepts_trade ? "aceita permuta" : null,
                  priv.commercial_conditions,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Row>
            </dl>
          </Card>

          <Card title={`Documentos (${docs?.length ?? 0})`}>
            {docs?.length ? (
              <ul className="space-y-1 text-sm">
                {docs.map((d, i) => (
                  <li key={d.id}>
                    {documents[i] ? (
                      <a href={documents[i]!} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">
                        {d.label}
                      </a>
                    ) : (
                      d.label
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Decisão">
            <StatusPanel propertyId={p.id} status={p.status} ownerApproved={ownerApproved} />
            {p.rejection_reason ? (
              <p className="mt-3 text-sm text-muted-foreground">Último pedido de ajuste: {p.rejection_reason}</p>
            ) : null}
          </Card>

          <Card title="Proprietário">
            {owner ? (
              <dl className="text-sm">
                <p className="font-medium">{owner.full_name || "Sem nome"}</p>
                <p className="text-muted-foreground">{owner.email}</p>
                <p className="text-muted-foreground">{formatPhone(owner.phone)}</p>
                <p className="mt-2">
                  {ownerApproved ? (
                    <span className="text-emerald-700">Aprovado em {formatDate(owner.decided_at)}</span>
                  ) : (
                    <Link
                      href={`/master/proprietarios?status=${owner.status}#${owner.user_id}`}
                      className="font-medium text-amber-700 underline"
                    >
                      {owner.status === "bloqueado" ? "Bloqueado" : "Aguardando aprovação"}: revisar cadastro
                    </Link>
                  )}
                </p>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Proprietário não encontrado.</p>
            )}
          </Card>

          <Card title="Localização no anúncio">
            <form action={setLocationPrecisionAction.bind(null, p.id)} className="flex gap-2">
              <label htmlFor="precision" className="sr-only">
                Precisão
              </label>
              <select
                id="precision"
                name="precision"
                defaultValue={p.location_precision}
                className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="bairro">Só o bairro (sem mapa)</option>
                <option value="aproximado">Região aproximada (~450 m)</option>
                <option value="exato">Ponto exato</option>
              </select>
              <Button type="submit" variant="outline" className="h-10">
                Salvar
              </Button>
            </form>
            {priv.exact_lat === null ? (
              <p className="mt-2 text-xs text-muted-foreground">Endereço sem coordenada: o anúncio não mostra mapa.</p>
            ) : null}
          </Card>

          <Card title="Comissão">
            <CommissionForm propertyId={p.id} initial={priv.commission_pct} />
          </Card>
        </aside>
      </div>
    </>
  );
}

/** URLs assinadas (10 min) de arquivos do bucket privado, na mesma ordem. */
async function signed(
  db: Awaited<ReturnType<typeof requireMasterPage>>["supabase"],
  paths: string[],
): Promise<(string | null)[]> {
  const real = paths.filter(Boolean);
  if (!real.length) return paths.map(() => null);
  const { data } = await db.storage.from("property-docs").createSignedUrls(real, 600);
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return paths.map((p) => (p ? (byPath.get(p) ?? null) : null));
}
