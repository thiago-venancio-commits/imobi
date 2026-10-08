"use client";

import { useActionState } from "react";

import { createPropertyAction } from "@/app/(site)/proprietario/actions";
import { FormNotice } from "@/components/auth/form-parts";
import { SaveButton, SelectField, TextField } from "@/components/forms/fields";
import type { ActionState } from "@/lib/auth/schemas";
import { PROPERTY_PURPOSES, PROPERTY_TYPES } from "@/lib/properties";

export function NewPropertyForm() {
  const [state, action] = useActionState<ActionState, FormData>(createPropertyAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormNotice state={state} />
      <SelectField name="type" label="Tipo de imóvel" state={state} options={PROPERTY_TYPES} placeholder="Escolha..." />
      <SelectField
        name="purpose"
        label="Finalidade"
        state={state}
        options={PROPERTY_PURPOSES}
        placeholder="Escolha..."
      />
      <TextField
        name="title"
        label="Título do anúncio"
        placeholder="Ex.: Casa com 3 quartos e quintal no Castelo"
        hint="Não coloque telefone, e-mail nem links: eles são removidos automaticamente."
        state={state}
      />
      <SaveButton className="h-11 w-full" pending="Criando...">
        Continuar
      </SaveButton>
    </form>
  );
}
