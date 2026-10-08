import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UpdatePasswordForm } from "@/components/auth/password-forms";
import { getCaller } from "@/lib/server/caller";

export const metadata: Metadata = { title: "Nova senha" };

/**
 * Destino do link de recuperação, depois que /auth/confirm validou o token.
 *
 * Esta página é a que os dois apps anteriores esqueceram: o e-mail de "esqueci
 * a senha" apontava para o login, que respondia "você já está logado".
 */
export default async function ResetPasswordPage() {
  // Sem sessão não há como trocar a senha: o link expirou ou nunca foi aberto.
  const caller = await getCaller();
  if (!caller) redirect("/esqueci-senha");

  return (
    <>
      <h1 className="text-2xl font-bold">Criar nova senha</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Escolha uma senha que você não use em outros sites.</p>
      <UpdatePasswordForm />
    </>
  );
}
