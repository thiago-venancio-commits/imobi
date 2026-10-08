"use client";

import { useActionState } from "react";

import { applyAsOwnerAction } from "@/app/(site)/proprietario/actions";
import { FormNotice } from "@/components/auth/form-parts";
import { CheckboxField, SaveButton, TextField } from "@/components/forms/fields";
import type { ActionState } from "@/lib/auth/schemas";

export function OwnerApplicationForm({
  initial,
}: {
  initial: { fullName: string; phone: string; whatsapp: string };
}) {
  const [state, action] = useActionState<ActionState, FormData>(applyAsOwnerAction, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormNotice state={state} />
      <TextField name="fullName" label="Nome completo" autoComplete="name" state={state} initial={initial.fullName} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="phone"
          label="Telefone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(31) 99999-9999"
          state={state}
          initial={initial.phone}
        />
        <TextField
          name="whatsapp"
          label="WhatsApp (opcional)"
          type="tel"
          inputMode="tel"
          placeholder="Se for diferente do telefone"
          state={state}
          initial={initial.whatsapp}
        />
      </div>
      <TextField
        name="cpfCnpj"
        label="CPF ou CNPJ (opcional)"
        inputMode="numeric"
        hint="Ajuda a equipe a confirmar a titularidade do imóvel. Nunca aparece no anúncio."
        state={state}
      />
      <CheckboxField
        name="declare"
        state={state}
        label="Declaro que sou o proprietário do imóvel ou tenho autorização para anunciá-lo."
      />
      <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">
        Seu telefone e seus dados ficam só com a equipe TSV. Compradores nunca veem seu contato, e você
        também não vê o deles: toda negociação passa pela nossa equipe.
      </p>
      <SaveButton className="h-11 w-full" pending="Enviando...">
        Continuar para o cadastro do imóvel
      </SaveButton>
    </form>
  );
}
