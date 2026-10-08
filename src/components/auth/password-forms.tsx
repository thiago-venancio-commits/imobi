"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  requestResetAction,
  updatePasswordAction,
  verifyEmailLinkAction,
} from "@/app/(auth)/actions";
import { Field, FormNotice, SubmitButton } from "@/components/auth/form-parts";
import { Turnstile } from "@/components/auth/turnstile";
import type { ActionState } from "@/lib/auth/schemas";

export function RequestResetForm() {
  const [state, action] = useActionState<ActionState, FormData>(requestResetAction, {});

  if (state.message) {
    return (
      <div className="space-y-4">
        <FormNotice state={state} />
        <Link href="/entrar" className="block text-center text-sm font-medium text-brand-500 hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormNotice state={state} />
      <Field name="email" label="E-mail da sua conta" type="email" autoComplete="email" state={state} />
      <Turnstile action="reset" resetKey={state} />
      <SubmitButton pending="Enviando...">Enviar link</SubmitButton>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action] = useActionState<ActionState, FormData>(updatePasswordAction, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormNotice state={state} />
      <Field
        name="password"
        label="Nova senha"
        type="password"
        autoComplete="new-password"
        hint="Mínimo de 8 caracteres, com letras e números."
        state={state}
      />
      <Field
        name="confirmPassword"
        label="Confirme a nova senha"
        type="password"
        autoComplete="new-password"
        state={state}
      />
      <SubmitButton pending="Salvando...">Salvar nova senha</SubmitButton>
    </form>
  );
}

export function VerifyLinkForm({
  tokenHash,
  type,
  code,
  next,
  label,
}: {
  tokenHash?: string;
  type?: string;
  code?: string;
  next?: string;
  label: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(verifyEmailLinkAction, {});

  return (
    <form action={action} className="space-y-4">
      {code ? <input type="hidden" name="code" value={code} /> : null}
      {tokenHash ? <input type="hidden" name="token_hash" value={tokenHash} /> : null}
      {type ? <input type="hidden" name="type" value={type} /> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormNotice state={state} />
      <SubmitButton pending="Confirmando...">{label}</SubmitButton>
    </form>
  );
}
