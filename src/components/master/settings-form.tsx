"use client";

import { useActionState } from "react";

import { saveSettingsAction } from "@/app/(site)/master/actions";
import { FormNotice } from "@/components/auth/form-parts";
import { SaveButton, TextField } from "@/components/forms/fields";
import type { ActionState } from "@/lib/auth/schemas";

export function SettingsForm({ initial }: { initial: { masterWhatsapp: string; masterEmail: string } }) {
  const [state, action] = useActionState<ActionState, FormData>(saveSettingsAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormNotice state={state} />
      <TextField
        name="masterWhatsapp"
        label="WhatsApp do atendimento"
        type="tel"
        inputMode="tel"
        placeholder="5531999998888"
        hint="Com DDI 55 e DDD, só números."
        state={state}
        initial={initial.masterWhatsapp}
      />
      <TextField
        name="masterEmail"
        label="E-mail do atendimento"
        type="email"
        state={state}
        initial={initial.masterEmail}
      />
      <SaveButton />
    </form>
  );
}
