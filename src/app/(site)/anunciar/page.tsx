import { Camera, CheckCircle2, ClipboardList, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OwnerApplicationForm } from "@/components/owner/owner-application-form";
import { Button } from "@/components/ui/button";
import { getCaller } from "@/lib/server/caller";

export const metadata: Metadata = {
  title: "Anunciar meu imóvel",
  description:
    "Cadastre seu imóvel na TSV Imóveis. Nossa equipe revisa, publica e cuida de todo o atendimento aos interessados.",
};

const STEPS = [
  { icon: ClipboardList, title: "Você cadastra", text: "Dados, endereço, valores e fotos do imóvel." },
  { icon: ShieldCheck, title: "A equipe revisa", text: "Conferimos as informações antes de publicar." },
  { icon: Camera, title: "O anúncio vai ao ar", text: "Sem seu contato e sem o valor: os interessados falam com a equipe." },
  { icon: CheckCircle2, title: "Nós intermediamos", text: "Visitas, propostas e negociação passam pela TSV." },
];

export default async function AnnouncePage() {
  const caller = await getCaller();

  if (caller && (caller.ownerStatus === "pendente" || caller.ownerStatus === "aprovado")) {
    redirect("/proprietario");
  }

  let initial = { fullName: "", phone: "", whatsapp: "" };
  if (caller && caller.ownerStatus !== "bloqueado") {
    const [{ data: profile }, { data: contact }] = await Promise.all([
      caller.supabase.from("profiles").select("full_name").eq("id", caller.userId).maybeSingle(),
      caller.supabase.from("contacts").select("phone, whatsapp").eq("user_id", caller.userId).maybeSingle(),
    ]);
    initial = {
      fullName: profile?.full_name ?? "",
      phone: contact?.phone ?? "",
      whatsapp: contact?.whatsapp ?? "",
    };
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_28rem]">
      <section>
        <h1 className="text-3xl font-extrabold tracking-tight">Anuncie seu imóvel com a TSV</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Você cadastra, nós cuidamos do resto. Seu anúncio aparece sem o seu contato e sem o valor: quem
          se interessa fala com a nossa equipe, que filtra, atende e leva até você só o que é sério.
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl bg-card p-5 ring-1 ring-border">
              <s.icon className="size-6 text-brand-500" aria-hidden />
              <h2 className="mt-3 font-semibold">
                {i + 1}. {s.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="h-fit rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border">
        {!caller ? (
          <>
            <h2 className="text-lg font-bold">Comece pela sua conta</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie uma conta gratuita ou entre na sua. Depois de confirmar o e-mail, volte para esta página.
            </p>
            <div className="mt-5 grid gap-3">
              <Button size="lg" className="h-11" render={<Link href="/cadastro?next=/anunciar" />}>
                Criar conta
              </Button>
              <Button size="lg" variant="outline" className="h-11" render={<Link href="/entrar?next=/anunciar" />}>
                Já tenho conta
              </Button>
            </div>
          </>
        ) : caller.ownerStatus === "bloqueado" ? (
          <>
            <h2 className="text-lg font-bold">Cadastro indisponível</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sua conta de proprietário está bloqueada. Fale com a nossa equipe para entender o motivo.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold">Seus dados de proprietário</h2>
            <p className="mb-5 mt-1 text-sm text-muted-foreground">
              Você já pode cadastrar o imóvel em seguida. A equipe confirma seus dados antes de publicar.
            </p>
            <OwnerApplicationForm initial={initial} />
          </>
        )}
      </section>
    </div>
  );
}
