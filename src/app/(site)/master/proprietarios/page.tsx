import type { Metadata } from "next";
import Link from "next/link";

import { setOwnerStatusAction } from "@/app/(site)/master/actions";
import { formatDate, formatPhone, StatusTabs } from "@/components/master/status-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireMasterPage } from "@/lib/server/page-guards";
import type { OwnerStatus } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Proprietários" };

const TABS: { value: OwnerStatus; label: string }[] = [
  { value: "pendente", label: "Aguardando aprovação" },
  { value: "aprovado", label: "Aprovados" },
  { value: "bloqueado", label: "Bloqueados" },
];

export default async function MasterOwnersPage({ searchParams }: PageProps<"/master/proprietarios">) {
  const caller = await requireMasterPage("/master/proprietarios");
  const { status: raw } = await searchParams;
  const status = TABS.find((t) => t.value === raw)?.value ?? "pendente";

  // master_owners() é a única fonte do e-mail do proprietário, e recusa quem
  // não é Master dentro do próprio banco.
  const { data: owners, error } = await caller.supabase.rpc("master_owners", { _status: status });

  return (
    <>
      <h1 className="text-2xl font-bold">Proprietários</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        Aprovar o proprietário é condição para publicar os imóveis dele. Bloquear tira o acesso de escrita na hora.
      </p>
      <StatusTabs base="/master/proprietarios" current={status} tabs={TABS} />

      {error ? (
        <p role="alert" className="mt-6 text-sm text-destructive">
          Não foi possível carregar a lista.
        </p>
      ) : !owners?.length ? (
        <p className="mt-6 rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-border">
          Nenhum proprietário nesta lista.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {owners.map((o) => (
            <li key={o.user_id} id={o.user_id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {o.full_name || "Sem nome"}
                    {o.user_status === "bloqueado" ? (
                      <Badge variant="destructive" className="ml-2">
                        Usuário bloqueado
                      </Badge>
                    ) : null}
                  </p>
                  <dl className="mt-1 grid gap-x-6 gap-y-0.5 text-sm text-muted-foreground sm:grid-cols-2">
                    <div>
                      <dt className="sr-only">E-mail</dt>
                      <dd>{o.email}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Telefone</dt>
                      <dd>
                        {formatPhone(o.phone)}
                        {o.whatsapp && o.whatsapp !== o.phone ? ` · WhatsApp ${formatPhone(o.whatsapp)}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="sr-only">Documento</dt>
                      <dd>{o.cpf_cnpj ? `CPF/CNPJ ${o.cpf_cnpj}` : "CPF/CNPJ não informado"}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Cadastro</dt>
                      <dd>
                        Desde {formatDate(o.applied_at)} ·{" "}
                        <Link href={`/master/imoveis?status=todos&owner=${o.user_id}`} className="hover:underline">
                          {o.properties_count} imóve{Number(o.properties_count) === 1 ? "l" : "is"}
                        </Link>
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="flex gap-2">
                  {o.status !== "aprovado" ? (
                    <form action={setOwnerStatusAction.bind(null, o.user_id, "aprovado")}>
                      <Button type="submit" className="h-9">
                        {o.status === "bloqueado" ? "Desbloquear" : "Aprovar"}
                      </Button>
                    </form>
                  ) : null}
                  {o.status !== "bloqueado" ? (
                    <form action={setOwnerStatusAction.bind(null, o.user_id, "bloqueado")}>
                      <Button type="submit" variant="destructive" className="h-9">
                        Bloquear
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
