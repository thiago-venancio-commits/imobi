/**
 * Consulta de CEP (ViaCEP), feita do navegador.
 *
 * O formato vem do brazilian-apis.service.ts do imovel-connect-br; o código é
 * novo. O resultado só preenche o formulário: o que vale é o que o dono salva,
 * e o servidor valida de novo.
 */
export interface CepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export function cepDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function formatCep(value: string): string {
  const d = cepDigits(value);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Endereço do CEP, ou null se o CEP não existir. Lança erro se a consulta falhar. */
export async function lookupCep(value: string, signal?: AbortSignal): Promise<CepAddress | null> {
  const cep = cepDigits(value);
  if (cep.length !== 8) return null;

  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal });
  if (!res.ok) throw new Error(`ViaCEP respondeu ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  if (data.erro) return null;

  const text = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    street: text(data.logradouro),
    neighborhood: text(data.bairro),
    city: text(data.localidade),
    state: text(data.uf),
  };
}

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
