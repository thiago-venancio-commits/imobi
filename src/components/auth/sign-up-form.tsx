"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signUpAction } from "@/app/(auth)/actions";
import { Field, FormNotice, SubmitButton } from "@/components/auth/form-parts";
import type { ActionState } from "@/lib/auth/schemas";

export function SignUpForm() {
  const [state, action] = useActionState<ActionState, FormData>(signUpAction, {});
  const termsError = state.fieldErrors?.acceptTerms?.[0];

  // Depois de enviar com sucesso o formulário some: o que importa agora é a
  // mensagem "confira seu e-mail", e deixar os campos na tela convida a
  // reenviar e a achar que nada aconteceu.
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
      <Field name="fullName" label="Nome completo" autoComplete="name" state={state} />
      <Field name="email" label="E-mail" type="email" autoComplete="email" state={state} />
      <Field
        name="password"
        label="Senha"
        type="password"
        autoComplete="new-password"
        hint="Mínimo de 8 caracteres, com letras e números."
        state={state}
      />
      <Field
        name="confirmPassword"
        label="Confirme a senha"
        type="password"
        autoComplete="new-password"
        state={state}
      />

      <div className="space-y-1.5">
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            aria-invalid={termsError ? true : undefined}
            className="mt-0.5 size-4 shrink-0 accent-brand-500"
          />
          <span>
            Li e aceito os <Link href="/termos" className="font-medium text-brand-500 hover:underline">termos de uso</Link>{" "}
            e a <Link href="/privacidade" className="font-medium text-brand-500 hover:underline">política de privacidade</Link>.
          </span>
        </label>
        {termsError ? <p className="text-xs font-medium text-destructive">{termsError}</p> : null}
      </div>

      <SubmitButton pending="Criando conta...">Criar conta</SubmitButton>
    </form>
  );
}
