import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/sign-in-form";
import { safeNext } from "@/lib/auth/safe-redirect";
import { getCaller } from "@/lib/server/caller";
import { homeFor } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const rawNext = typeof params.next === "string" ? params.next : undefined;
  const next = rawNext ? safeNext(rawNext, "") || undefined : undefined;

  // Quem já está logado não vê o formulário de novo.
  const caller = await getCaller();
  if (caller) redirect(next ?? homeFor(caller));

  return (
    <>
      <h1 className="text-2xl font-bold">Entrar</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Acesse sua conta para acompanhar seus interesses, imóveis e negociações.
      </p>

      <SignInForm next={next} />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-brand-500 hover:underline">
          Cadastre-se
        </Link>
      </p>
    </>
  );
}
