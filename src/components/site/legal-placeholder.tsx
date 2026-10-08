/**
 * Marcador de documento legal ainda não redigido.
 *
 * O cadastro pede "li e aceito os termos", então o link precisa existir, mas o
 * texto jurídico não é nosso para inventar: o cliente (ou o advogado dele)
 * escreve. Esta página diz isso claramente em vez de exibir um texto genérico
 * que pareça valer.
 *
 * BLOQUEIO DE LANÇAMENTO: trocar pelas versões reais antes de abrir o cadastro
 * ao público.
 */
export function LegalPlaceholder({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Este documento está em elaboração e será publicado antes da abertura oficial da plataforma.
      </p>
    </div>
  );
}
