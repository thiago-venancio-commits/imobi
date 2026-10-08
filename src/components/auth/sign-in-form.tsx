"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInAction } from "@/app/(auth)/actions";
import { Field, FormNotice, SubmitButton } from "@/components/auth/form-parts";
import { Turnstile } from "@/components/auth/turnstile";
import type { ActionState } from "@/lib/auth/schemas";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(signInAction, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormNotice state={state} />
      <Field name="email" label="E-mail" type="email" autoComplete="email" state={state} />
      <Field name="password" label="Senha" type="password" autoComplete="current-password" state={state} />
      <div className="text-right">
        <Link href="/esqueci-senha" className="text-sm font-medium text-brand-500 hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      <Turnstile action="login" resetKey={state} />
      <SubmitButton pending="Entrando...">Entrar</SubmitButton>
    </form>
  );
}
