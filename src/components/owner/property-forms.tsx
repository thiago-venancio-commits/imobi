"use client";

import { useActionState, useState } from "react";

import {
  saveDetailsAction,
  saveLocationAction,
  saveValuesAction,
  submitPropertyAction,
} from "@/app/(site)/proprietario/actions";
import { FormNotice } from "@/components/auth/form-parts";
import { CheckboxField, SaveButton, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import type { ActionState } from "@/lib/auth/schemas";
import { cepDigits, formatCep, lookupCep, UFS } from "@/lib/cep";
import { PROPERTY_CONDITIONS, PROPERTY_PURPOSES, PROPERTY_TYPES } from "@/lib/properties";

/** Número para exibir num campo de valor: "650.000" em vez de "650000.00". */
function money(v: number | string | null): string {
  if (v === null || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n)
    ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n)
    : "";
}

function num(v: number | string | null): string {
  if (v === null || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

// ---------------------------------------------------------------------------
export interface DetailsInitial {
  title: string;
  description: string;
  type: string;
  purpose: string;
  condition: string;
  in_condominium: boolean;
  bedrooms: number;
  suites: number;
  bathrooms: number;
  parking_spaces: number;
  total_area: number | null;
  built_area: number | null;
  land_area: number | null;
  condo_fee: number | null;
  features: string[];
  amenities: string[];
}

export function DetailsForm({ propertyId, initial }: { propertyId: string; initial: DetailsInitial }) {
  const [state, action] = useActionState<ActionState, FormData>(saveDetailsAction.bind(null, propertyId), {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormNotice state={state} />
      <TextField
        name="title"
        label="Título do anúncio"
        state={state}
        initial={initial.title}
        hint="Telefone, e-mail e links são removidos automaticamente."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField name="type" label="Tipo" state={state} initial={initial.type} options={PROPERTY_TYPES} />
        <SelectField
          name="purpose"
          label="Finalidade"
          state={state}
          initial={initial.purpose}
          options={PROPERTY_PURPOSES}
        />
        <SelectField
          name="condition"
          label="Condição"
          state={state}
          initial={initial.condition}
          options={PROPERTY_CONDITIONS}
        />
      </div>
      <TextAreaField
        name="description"
        label="Descrição"
        rows={6}
        state={state}
        initial={initial.description}
        hint="Conte o que o imóvel tem de melhor. Não inclua contato nem endereço com número."
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <TextField name="bedrooms" label="Quartos" inputMode="numeric" state={state} initial={initial.bedrooms} />
        <TextField name="suites" label="Suítes" inputMode="numeric" state={state} initial={initial.suites} />
        <TextField name="bathrooms" label="Banheiros" inputMode="numeric" state={state} initial={initial.bathrooms} />
        <TextField
          name="parkingSpaces"
          label="Vagas"
          inputMode="numeric"
          state={state}
          initial={initial.parking_spaces}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <TextField
          name="totalArea"
          label="Área total (m²)"
          inputMode="decimal"
          state={state}
          initial={num(initial.total_area)}
        />
        <TextField
          name="builtArea"
          label="Área construída (m²)"
          inputMode="decimal"
          state={state}
          initial={num(initial.built_area)}
        />
        <TextField
          name="landArea"
          label="Terreno (m²)"
          inputMode="decimal"
          state={state}
          initial={num(initial.land_area)}
        />
        <TextField
          name="condoFee"
          label="Condomínio (R$/mês)"
          inputMode="decimal"
          state={state}
          initial={money(initial.condo_fee)}
        />
      </div>
      <CheckboxField name="inCondominium" label="Imóvel em condomínio" state={state} initial={initial.in_condominium} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextAreaField
          name="features"
          label="Características"
          rows={4}
          state={state}
          initial={initial.features.join("\n")}
          hint="Uma por linha. Ex.: varanda gourmet, armários planejados."
        />
        <TextAreaField
          name="amenities"
          label="Comodidades / lazer"
          rows={4}
          state={state}
          initial={initial.amenities.join("\n")}
          hint="Uma por linha. Ex.: piscina, academia, portaria 24h."
        />
      </div>
      <SaveButton />
    </form>
  );
}

// ---------------------------------------------------------------------------
export interface LocationInitial {
  cep: string;
  address: string;
  street_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  landmarks: string;
}

export function LocationForm({ propertyId, initial }: { propertyId: string; initial: LocationInitial }) {
  const [state, action] = useActionState<ActionState, FormData>(saveLocationAction.bind(null, propertyId), {});
  const [cepStatus, setCepStatus] = useState<"" | "loading" | "notfound" | "error">("");

  // Preenche os campos direto no formulário: os inputs são não controlados
  // (ver components/forms/fields.tsx), então escrevemos no elemento.
  async function onCepBlur(e: React.FocusEvent<HTMLInputElement>) {
    const form = e.currentTarget.form;
    const cep = cepDigits(e.currentTarget.value);
    e.currentTarget.value = formatCep(cep);
    if (!form || cep.length !== 8) return;
    setCepStatus("loading");
    try {
      const found = await lookupCep(cep);
      if (!found) {
        setCepStatus("notfound");
        return;
      }
      const set = (name: string, value: string) => {
        const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
        if (el && value) el.value = value;
      };
      set("address", found.street);
      set("neighborhood", found.neighborhood);
      set("city", found.city);
      set("state", found.state);
      setCepStatus("");
      (form.elements.namedItem(found.street ? "streetNumber" : "address") as HTMLInputElement | null)?.focus();
    } catch {
      setCepStatus("error");
    }
  }

  const cepHint =
    cepStatus === "loading"
      ? "Buscando endereço..."
      : cepStatus === "notfound"
        ? "CEP não encontrado. Preencha o endereço à mão."
        : cepStatus === "error"
          ? "Não foi possível consultar o CEP agora. Preencha o endereço à mão."
          : "Digite o CEP para preencher o endereço.";

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormNotice state={state} />
      <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">
        O endereço completo fica só com você e a equipe TSV. O anúncio mostra apenas bairro, cidade e uma
        região aproximada no mapa.
      </p>
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <TextField
          name="cep"
          label="CEP"
          inputMode="numeric"
          autoComplete="postal-code"
          state={state}
          initial={formatCep(initial.cep)}
          hint={cepHint}
          onBlur={onCepBlur}
        />
        <TextField name="address" label="Rua" autoComplete="address-line1" state={state} initial={initial.address} />
      </div>
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <TextField name="streetNumber" label="Número" state={state} initial={initial.street_number} />
        <TextField name="complement" label="Complemento" state={state} initial={initial.complement} />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_7rem]">
        <TextField name="neighborhood" label="Bairro" state={state} initial={initial.neighborhood} />
        <TextField name="city" label="Cidade" state={state} initial={initial.city} />
        <SelectField
          name="state"
          label="UF"
          state={state}
          initial={initial.state}
          placeholder="--"
          options={UFS.map((uf) => ({ value: uf, label: uf }))}
        />
      </div>
      <TextField
        name="landmarks"
        label="Pontos de referência (aparece no anúncio)"
        state={state}
        initial={initial.landmarks}
        hint="Ex.: próximo à Praça da Liberdade. Sem número de casa."
      />
      <SaveButton />
    </form>
  );
}

// ---------------------------------------------------------------------------
export interface ValuesInitial {
  price_sale: number | null;
  price_rent: number | null;
  min_price: number | null;
  down_payment: number | null;
  commercial_conditions: string;
  accepts_financing: boolean;
  accepts_trade: boolean;
}

export function ValuesForm({
  propertyId,
  purpose,
  initial,
}: {
  propertyId: string;
  purpose: string;
  initial: ValuesInitial;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveValuesAction.bind(null, propertyId), {});
  const sale = purpose !== "locacao";
  const rent = purpose !== "venda";
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormNotice state={state} />
      <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">
        <strong>Só você e a equipe TSV veem estes números.</strong> O anúncio mostra &quot;valor sob
        consulta&quot; e uma faixa de preço larga (ex.: R$ 600 mil a R$ 1 milhão), nunca o valor.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {sale ? (
          <TextField
            name="priceSale"
            label="Valor de venda (R$)"
            inputMode="decimal"
            placeholder="650.000"
            state={state}
            initial={money(initial.price_sale)}
          />
        ) : (
          <input type="hidden" name="priceSale" value={money(initial.price_sale)} />
        )}
        {rent ? (
          <TextField
            name="priceRent"
            label="Aluguel mensal (R$)"
            inputMode="decimal"
            placeholder="3.500"
            state={state}
            initial={money(initial.price_rent)}
          />
        ) : (
          <input type="hidden" name="priceRent" value={money(initial.price_rent)} />
        )}
        <TextField
          name="minPrice"
          label="Menor valor que aceita (opcional)"
          inputMode="decimal"
          state={state}
          initial={money(initial.min_price)}
          hint="Ajuda a equipe a negociar por você."
        />
        <TextField
          name="downPayment"
          label="Entrada mínima (opcional)"
          inputMode="decimal"
          state={state}
          initial={money(initial.down_payment)}
        />
      </div>
      <TextAreaField
        name="commercialConditions"
        label="Condições comerciais (opcional)"
        rows={3}
        state={state}
        initial={initial.commercial_conditions}
        hint="Ex.: aceita permuta por apartamento menor, desocupa em 60 dias."
      />
      <div className="flex flex-wrap gap-6">
        <CheckboxField name="acceptsFinancing" label="Aceita financiamento" state={state} initial={initial.accepts_financing} />
        <CheckboxField name="acceptsTrade" label="Aceita permuta" state={state} initial={initial.accepts_trade} />
      </div>
      <SaveButton />
    </form>
  );
}

// ---------------------------------------------------------------------------
export function SubmitForm({ propertyId, label }: { propertyId: string; label: string }) {
  const [state, action] = useActionState<ActionState, FormData>(() => submitPropertyAction(propertyId), {});
  return (
    <form action={action} className="space-y-3">
      <FormNotice state={state} />
      {state.message ? null : (
        <SaveButton className="h-11 w-full" pending="Enviando...">
          {label}
        </SaveButton>
      )}
    </form>
  );
}
