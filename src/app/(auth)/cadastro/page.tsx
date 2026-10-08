import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { getCaller } from "@/lib/server/caller";
import { homeFor } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage() {
  const caller = await getCaller();
  if (caller) redirect(homeFor(caller));

  return (
    <>
      <h1 className="text-2xl font-bold">Criar conta</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        É grátis. Com a conta você salva favoritos, cadastra o que procura e acompanha o atendimento.
      </p>

      <SignUpForm />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-brand-500 hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
