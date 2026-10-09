import { Check, Circle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentsManager, MediaManager } from "@/components/owner/media-manager";
import { DetailsForm, LocationForm, SubmitForm, ValuesForm } from "@/components/owner/property-forms";
import { StatusBadge } from "@/components/property/status-badge";
import { mediaUrl, PUBLIC_STATUSES, SUBMITTABLE_STATUSES } from "@/lib/properties";
import { requireOwnerPage } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Editar imóvel" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="mb-4 mt-1 text-sm text-muted-foreground">{description}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

export default async function EditPropertyPage({ params, searchParams }: PageProps<"/proprietario/imoveis/[id]">) {
  const { id } = await params;
  const { novo } = await searchParams;
  if (!UUID.test(id)) notFound();
  const caller = await requireOwnerPage(`/proprietario/imoveis/${id}`);
  const supabase = caller.supabase;

  // Tudo com o cliente do usuário: se o imóvel não for dele, a RLS devolve
  // nada e a página dá 404.
  const [{ data: p }, { data: priv }, { data: media }, { data: docs }] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle(),
    supabase.from("property_private").select("*").eq("property_id", id).maybeSingle(),
    supabase.from("property_media").select("id, kind, storage_path, is_cover, position").eq("property_id", id).order("position"),
    supabase.from("property_documents").select("id, label, storage_path").eq("property_id", id).order("created_at"),
  ]);
  if (!p || !priv) notFound();

  const signed = docs?.length
    ? (await supabase.storage.from("property-docs").createSignedUrls(docs.map((d) => d.storage_path), 600)).data
    : [];

  const photos = (media ?? []).filter((m) => m.kind === "foto").length;
  const needsSale = p.purpose !== "locacao";
  const needsRent = p.purpose !== "venda";
  const checklist = [
    { done: p.title.trim() !== "", label: "Título", href: "#dados" },
    { done: p.neighborhood !== "" && p.city !== "" && p.state.trim() !== "", label: "Bairro, cidade e estado", href: "#localizacao" },
    { done: priv.address !== "", label: "Endereço completo (só a equipe vê)", href: "#localizacao" },
    {
      done: (!needsSale || priv.price_sale !== null) && (!needsRent || priv.price_rent !== null),
      label: needsSale && needsRent ? "Valores de venda e aluguel" : needsSale ? "Valor de venda" : "Valor do aluguel",
      href: "#valores",
    },
    { done: photos > 0, label: "Pelo menos uma foto", href: "#fotos" },
  ];

  const isPublic = PUBLIC_STATUSES.includes(p.status);
  const canSubmit = SUBMITTABLE_STATUSES.includes(p.status);

  return (
    <>
      <Link href="/proprietario" className="text-sm text-muted-foreground hover:underline">
        ← Meus imóveis
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{p.title || "Imóvel sem título"}</h1>
        <StatusBadge status={p.status} />
        <span className="text-sm text-muted-foreground">{p.code}</span>
      </div>

      {novo ? (
        <p role="status" className="mt-4 rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          Imóvel criado como rascunho. Complete as seções abaixo e clique em <strong>Enviar para aprovação</strong>.
        </p>
      ) : null}
      {p.status === "rejeitado" && p.rejection_reason ? (
        <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <strong>A equipe pediu ajustes:</strong> {p.rejection_reason}
        </p>
      ) : null}
      {isPublic ? (
        <p className="mt-4 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-950">
          Este anúncio está no ar. Mudar título, descrição, tipo, bairro, cidade ou fotos tira ele do ar
          até a equipe revisar de novo. Valores e endereço podem ser ajustados sem tirar do ar.
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_17rem]">
        <div className="space-y-6">
          <Section id="dados" title="Dados do imóvel">
            <DetailsForm
              propertyId={p.id}
              initial={{
                title: p.title,
                description: p.description,
                type: p.type,
                purpose: p.purpose,
                condition: p.condition,
                in_condominium: p.in_condominium,
                bedrooms: p.bedrooms,
                suites: p.suites,
                bathrooms: p.bathrooms,
                parking_spaces: p.parking_spaces,
                total_area: p.total_area,
                built_area: p.built_area,
                land_area: p.land_area,
                condo_fee: p.condo_fee,
                features: p.features,
                amenities: p.amenities,
              }}
            />
          </Section>

          <Section id="localizacao" title="Localização">
            <LocationForm
              propertyId={p.id}
              initial={{
                cep: priv.cep,
                address: priv.address,
                street_number: priv.street_number,
                complement: priv.complement,
                neighborhood: p.neighborhood,
                city: p.city,
                state: p.state.trim(),
                landmarks: p.landmarks,
              }}
            />
          </Section>

          <Section id="valores" title="Valores e condições">
            <ValuesForm
              propertyId={p.id}
              purpose={p.purpose}
              initial={{
                price_sale: priv.price_sale,
                price_rent: priv.price_rent,
                min_price: priv.min_price,
                down_payment: priv.down_payment,
                commercial_conditions: priv.commercial_conditions,
                accepts_financing: priv.accepts_financing,
                accepts_trade: priv.accepts_trade,
              }}
            />
          </Section>

          <Section id="fotos" title="Fotos e vídeos">
            <MediaManager
              propertyId={p.id}
              items={(media ?? []).map((m) => ({
                id: m.id,
                kind: m.kind,
                url: mediaUrl(m.storage_path),
                isCover: m.is_cover,
              }))}
            />
          </Section>

          <Section
            id="documentos"
            title="Documentos"
            description="Opcional agora, mas a equipe pode pedir antes de publicar."
          >
            <DocumentsManager
              propertyId={p.id}
              items={(docs ?? []).map((d, i) => ({ id: d.id, label: d.label, url: signed?.[i]?.signedUrl ?? null }))}
            />
          </Section>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl bg-card p-5 ring-1 ring-border lg:sticky lg:top-6">
          <h2 className="font-semibold">Para enviar</h2>
          <ul className="space-y-2 text-sm">
            {checklist.map((c) => (
              <li key={c.label}>
                <a href={c.href} className="flex items-start gap-2 hover:underline">
                  {c.done ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="feito" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="pendente" />
                  )}
                  <span className={c.done ? "text-muted-foreground" : undefined}>{c.label}</span>
                </a>
              </li>
            ))}
          </ul>
          {canSubmit ? (
            <SubmitForm
              propertyId={p.id}
              label={p.status === "rascunho" ? "Enviar para aprovação" : "Reenviar para aprovação"}
            />
          ) : p.status === "pausado" ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Anúncio bloqueado pela equipe TSV e fora do site. Só a equipe pode desbloquear; fale conosco para
              entender o motivo.
            </p>
          ) : p.status === "aguardando_aprovacao" ? (
            <p className="text-sm text-muted-foreground">Em análise pela equipe. Você pode continuar ajustando.</p>
          ) : isPublic ? (
            <p className="text-sm text-muted-foreground">
              No ar.{" "}
              <Link href={`/imoveis/${p.code}`} className="font-medium text-brand-500 hover:underline">
                Ver anúncio
              </Link>
            </p>
          ) : null}
        </aside>
      </div>
    </>
  );
}
