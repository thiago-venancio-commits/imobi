"use client";

import { useFormStatus } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/auth/schemas";

export function SubmitButton({ children, pending: label }: { children: React.ReactNode; pending?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
      {pending ? (label ?? "Aguarde...") : children}
    </Button>
  );
}

/** Aviso geral do formulário: erro (vermelho) ou confirmação. */
export function FormNotice({ state }: { state: ActionState }) {
  if (!state.error && !state.message) return null;
  const isError = Boolean(state.error);
  return (
    <Alert
      variant={isError ? "destructive" : "default"}
      role={isError ? "alert" : "status"}
      className={isError ? undefined : "border-brand-500/30 bg-accent text-accent-foreground"}
    >
      <AlertDescription>{state.error ?? state.message}</AlertDescription>
    </Alert>
  );
}

export function Field({
  name,
  label,
  state,
  type = "text",
  autoComplete,
  hint,
  required = true,
}: {
  name: string;
  label: string;
  state: ActionState;
  type?: string;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
}) {
  const errors = state.fieldErrors?.[name];
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  // Senhas nunca voltam preenchidas depois de um erro.
  const defaultValue = type === "password" ? undefined : state.values?.[name];

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        // O campo é não controlado; o Base UI não aceita trocar o valor
        // padrão depois de montado. Quando a ação devolve o que foi digitado,
        // a key nova remonta o campo já com esse valor.
        key={`${name}:${defaultValue ?? ""}`}
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={[errors?.length ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined}
        className="h-11"
      />
      {hint && !errors?.length ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}
