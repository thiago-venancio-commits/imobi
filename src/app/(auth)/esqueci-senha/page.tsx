import type { Metadata } from "next";
import Link from "next/link";

import { RequestResetForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Esqueci minha senha</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Informe o e-mail da conta e enviaremos um link para você criar uma nova senha.
      </p>

      <RequestResetForm />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Lembrou?{" "}
        <Link href="/entrar" className="font-medium text-brand-500 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
