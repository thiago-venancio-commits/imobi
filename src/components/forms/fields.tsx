"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/auth/schemas";
import { cn } from "@/lib/utils";

/**
 * Campos dos formulários de cadastro (proprietário e Master).
 *
 * Diferem dos campos de auth (components/auth/form-parts) num ponto: o valor
 * inicial vem do BANCO, e só é trocado pelo que o usuário digitou quando a
 * ação devolve erro (`state.values`). Os inputs são não controlados; a `key`
 * remonta o campo quando esse valor muda, porque o Base UI não aceita trocar
 * o valor padrão de um campo já montado.
 */

function useValue(name: string, state: ActionState, initial: string | number | null | undefined): string {
  return state.values?.[name] ?? (initial === null || initial === undefined ? "" : String(initial));
}

function FieldShell({
  name,
  label,
  hint,
  state,
  children,
  className,
}: {
  name: string;
  label: string;
  hint?: string;
  state: ActionState;
  children: React.ReactNode;
  className?: string;
}) {
  const error = state.fieldErrors?.[name]?.[0];
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(name: string, state: ActionState, hint?: string) {
  if (state.fieldErrors?.[name]?.length) return `${name}-error`;
  return hint ? `${name}-hint` : undefined;
}

export function TextField({
  name,
  label,
  state,
  initial,
  hint,
  type = "text",
  inputMode,
  autoComplete,
  required,
  placeholder,
  className,
  onBlur,
}: {
  name: string;
  label: string;
  state: ActionState;
  initial?: string | number | null;
  hint?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}) {
  const value = useValue(name, state, initial);
  return (
    <FieldShell name={name} label={label} hint={hint} state={state} className={className}>
      <Input
        key={`${name}:${value}`}
        id={name}
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        defaultValue={value}
        onBlur={onBlur}
        aria-invalid={state.fieldErrors?.[name]?.length ? true : undefined}
        aria-describedby={describedBy(name, state, hint)}
        className="h-10"
      />
    </FieldShell>
  );
}

export function TextAreaField({
  name,
  label,
  state,
  initial,
  hint,
  rows = 4,
  className,
}: {
  name: string;
  label: string;
  state: ActionState;
  initial?: string | null;
  hint?: string;
  rows?: number;
  className?: string;
}) {
  const value = useValue(name, state, initial);
  return (
    <FieldShell name={name} label={label} hint={hint} state={state} className={className}>
      <Textarea
        key={`${name}:${value}`}
        id={name}
        name={name}
        rows={rows}
        defaultValue={value}
        aria-invalid={state.fieldErrors?.[name]?.length ? true : undefined}
        aria-describedby={describedBy(name, state, hint)}
      />
    </FieldShell>
  );
}

/** Select nativo: funciona sem JavaScript e entra no FormData sem adaptação. */
export function SelectField({
  name,
  label,
  state,
  initial,
  options,
  hint,
  placeholder,
  className,
}: {
  name: string;
  label: string;
  state: ActionState;
  initial?: string | null;
  options: readonly { value: string; label: string }[];
  hint?: string;
  placeholder?: string;
  className?: string;
}) {
  const value = useValue(name, state, initial);
  return (
    <FieldShell name={name} label={label} hint={hint} state={state} className={className}>
      <select
        key={`${name}:${value}`}
        id={name}
        name={name}
        defaultValue={value}
        aria-invalid={state.fieldErrors?.[name]?.length ? true : undefined}
        aria-describedby={describedBy(name, state, hint)}
        className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  label,
  state,
  initial,
}: {
  name: string;
  label: React.ReactNode;
  state: ActionState;
  initial?: boolean;
}) {
  const checked = state.values ? state.values[name] === "on" : Boolean(initial);
  const error = state.fieldErrors?.[name]?.[0];
  return (
    <div className="space-y-1">
      <label className="flex items-start gap-2.5 text-sm">
        <input
          key={`${name}:${checked}`}
          type="checkbox"
          name={name}
          defaultChecked={checked}
          className="mt-0.5 size-4 shrink-0 accent-brand-500"
        />
        <span>{label}</span>
      </label>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

export function SaveButton({
  children = "Salvar",
  pending = "Salvando...",
  variant,
  className,
}: {
  children?: React.ReactNode;
  pending?: string;
  variant?: "default" | "outline" | "destructive" | "secondary";
  className?: string;
}) {
  const status = useFormStatus();
  return (
    <Button type="submit" disabled={status.pending} variant={variant} className={cn("h-10 px-5", className)}>
      {status.pending ? pending : children}
    </Button>
  );
}
