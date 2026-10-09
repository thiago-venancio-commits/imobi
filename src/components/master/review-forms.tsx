"use client";

import { useActionState, useState } from "react";

import { deletePropertyAction, setCommissionAction, setPropertyStatusAction } from "@/app/(site)/master/actions";
import { FormNotice } from "@/components/auth/form-parts";
import { SaveButton, TextAreaField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/auth/schemas";
import { PUBLIC_STATUSES, STATUS_LABELS } from "@/lib/properties";
import type { PropertyStatus } from "@/lib/supabase/database.types";

/**
 * Decisão do Master sobre o anúncio. O botão de publicar não aparece com o
 * proprietário pendente, mas é o trigger do banco que impede de fato.
 */
export function StatusPanel({
  propertyId,
  status,
  ownerApproved,
}: {
  propertyId: string;
  status: PropertyStatus;
  ownerApproved: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(setPropertyStatusAction.bind(null, propertyId), {});
  const [rejecting, setRejecting] = useState(false);

  // "Bloqueado" (pausado) tem botão próprio abaixo.
  const others: PropertyStatus[] = ["reservado", "em_negociacao", "vendido", "alugado", "cancelado"];
  const isPublic = PUBLIC_STATUSES.includes(status);

  return (
    <div className="space-y-3">
      <FormNotice state={state} />
      {status !== "publicado" ? (
        ownerApproved ? (
          <form action={action}>
            <input type="hidden" name="status" value="publicado" />
            <SaveButton className="h-10 w-full" pending="Publicando...">
              {status === "em_negociacao" || status === "reservado"
                ? "Voltar a disponível"
                : status === "pausado"
                  ? "Desbloquear e publicar"
                  : "Aprovar e publicar"}
            </SaveButton>
          </form>
        ) : (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-950">
            Aprove o proprietário antes de publicar.
          </p>
        )
      ) : null}

      {isPublic ? (
        <form action={action}>
          <input type="hidden" name="status" value="pausado" />
          <SaveButton variant="destructive" className="h-10 w-full" pending="Bloqueando...">
            Bloquear anúncio (tirar do ar)
          </SaveButton>
        </form>
      ) : null}

      {status !== "rejeitado" && status !== "pausado" ? (
        rejecting ? (
          <form action={action} className="space-y-2">
            <input type="hidden" name="status" value="rejeitado" />
            <TextAreaField
              name="reason"
              label="O que o proprietário precisa ajustar?"
              rows={3}
              state={state}
              hint="Ele vê este texto no painel dele."
            />
            <div className="flex gap-2">
              <SaveButton variant="destructive" pending="Enviando...">
                Rejeitar
              </SaveButton>
              <Button type="button" variant="ghost" className="h-10" onClick={() => setRejecting(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="outline" className="h-10 w-full" onClick={() => setRejecting(true)}>
            Pedir ajustes (rejeitar)
          </Button>
        )
      ) : null}

      <form action={action} className="flex gap-2">
        <label className="sr-only" htmlFor="status-other">
          Outro status
        </label>
        <select
          id="status-other"
          name="status"
          defaultValue=""
          className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm"
        >
          <option value="" disabled>
            Mudar para...
          </option>
          {others
            .filter((s) => s !== status)
            .map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
        </select>
        <SaveButton variant="outline">Aplicar</SaveButton>
      </form>
    </div>
  );
}

export function CommissionForm({ propertyId, initial }: { propertyId: string; initial: number | null }) {
  const [state, action] = useActionState<ActionState, FormData>(setCommissionAction.bind(null, propertyId), {});
  return (
    <form action={action} className="space-y-2">
      <FormNotice state={state} />
      <div className="flex items-end gap-2">
        <TextField
          name="commission"
          label="Comissão (%)"
          inputMode="decimal"
          state={state}
          initial={initial === null ? "" : String(initial)}
          className="flex-1"
        />
        <SaveButton variant="outline">Salvar</SaveButton>
      </div>
    </form>
  );
}


/**
 * Exclusão definitiva. Fica escondida atrás de um segundo clique e pede o
 * código do imóvel digitado, para não apagar o anúncio errado por engano.
 */
export function DeleteProperty({ propertyId, code }: { propertyId: string; code: string }) {
  const [state, action] = useActionState<ActionState, FormData>(deletePropertyAction.bind(null, propertyId), {});
  const [open, setOpen] = useState(false);

  if (!open && !state.error && !state.fieldErrors) {
    return (
      <Button type="button" variant="ghost" className="h-9 w-full text-destructive" onClick={() => setOpen(true)}>
        Excluir anúncio definitivamente...
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-xl bg-destructive/5 p-3 ring-1 ring-destructive/30">
      <FormNotice state={state} />
      <p className="text-sm">
        Apaga o anúncio, todas as fotos, vídeos, originais e documentos. <strong>Não dá para desfazer.</strong> Para
        só tirar do ar, use <em>Bloquear</em>.
      </p>
      <TextField name="confirmCode" label={`Digite ${code} para confirmar`} state={state} autoComplete="off" />
      <div className="flex gap-2">
        <SaveButton variant="destructive" pending="Excluindo...">
          Excluir para sempre
        </SaveButton>
        <Button type="button" variant="ghost" className="h-10" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
