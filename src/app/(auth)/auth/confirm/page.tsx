import type { Metadata } from "next";
import Link from "next/link";

import { VerifyLinkForm } from "@/components/auth/password-forms";
import { otpTypeSchema } from "@/lib/auth/schemas";
import { safeNext } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = {
  title: "Confirmar",
  // Link de uso único: não faz sentido indexar nem guardar em cache.
  robots: { index: false, follow: false },
};

const COPY = {
  recovery: {
    title: "Criar nova senha",
    text: "Clique no botão abaixo para continuar e escolher sua nova senha.",
    label: "Continuar",
  },
  default: {
    title: "Confirmar e-mail",
    text: "Clique no botão abaixo para confirmar seu e-mail e ativar a conta.",
    label: "Confirmar e-mail",
  },
} as const;

/**
 * A verificação NÃO acontece ao abrir esta página. Fica atrás de um botão,
 * porque scanners de e-mail abrem todo link da mensagem e consumiriam o token
 * de uso único antes de o usuário clicar. Ver verifyEmailLinkAction.
 */
export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  const type = otpTypeSchema.safeParse(params.type);
  const code = typeof params.code === "string" ? params.code : "";
  const next = typeof params.next === "string" ? safeNext(params.next, "") || undefined : undefined;

  const valid = Boolean(code) || (Boolean(tokenHash) && type.success);

  if (!valid) {
    return (
      <>
        <h1 className="text-2xl font-bold">Link inválido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este link está incompleto. Abra a mensagem original e use o botão de lá, ou peça um novo link.
        </p>
        <Link href="/entrar" className="mt-6 block text-center text-sm font-medium text-brand-500 hover:underline">
          Ir para o login
        </Link>
      </>
    );
  }

  // Com ?code= não há `type`; a recuperação é reconhecida pelo destino.
  const isRecovery = (type.success && type.data === "recovery") || next === "/auth/reset";
  const copy = isRecovery ? COPY.recovery : COPY.default;

  return (
    <>
      <h1 className="text-2xl font-bold">{copy.title}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{copy.text}</p>
      <VerifyLinkForm
        tokenHash={tokenHash || undefined}
        type={type.success ? type.data : undefined}
        code={code || undefined}
        next={next}
        label={copy.label}
      />
    </>
  );
}
