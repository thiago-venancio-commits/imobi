/**
 * Valida o destino de um redirecionamento vindo da URL (`?next=...`).
 *
 * Sem isso, um link como /entrar?next=https://site-falso.com leva o usuário,
 * logo depois de digitar a senha de verdade, para uma página que imita a nossa.
 * Só aceitamos caminhos internos: começam com uma única "/" e não escapam do
 * domínio por "//", por barra invertida ou por esquema.
 */
export function safeNext(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  // "//host" e "/\host" são lidos pelo navegador como outro domínio.
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Caracteres de controle e quebras de linha (header injection).
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
