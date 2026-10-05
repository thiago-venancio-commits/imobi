<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# imobi — regras do projeto

Plataforma de **intermediação** imobiliária com operador único (o Master).
Spec completa: `docs/ESPECIFICACAO.md`. Plano: `docs/PLANO.md`.

## As quatro regras absolutas

1. O comprador **nunca** vê preço, valor de aluguel, entrada, mínimo aceitável
   nem condição comercial (§4, §12, §35).
2. O comprador **nunca** vê contato do proprietário (§3, §13).
3. O proprietário **nunca** vê contato nem identidade do comprador (§3, §14).
4. Todo contato passa pelo Master ou por corretor autorizado (§41).

Elas não são regras de interface. São regras de **tabela**:
`properties` é a metade pública e não tem preço nem `owner_id`;
`property_private` tem preço e endereço; `contacts` tem telefone.
Esconder um campo no React não é implementar nenhuma delas — o PostgREST
continua servindo a coluna para quem chamar a API direto.

## Invariantes técnicas

- **A identidade vem do token, nunca do corpo da requisição.** Server Actions
  e Route Handlers resolvem quem é o chamador com `src/lib/server/caller.ts`.
  Um `user_id` no body diz *sobre o quê* agir, nunca *quem* está agindo.
- **Helpers ficam em `private`, sem parâmetro de usuário.** Um
  `has_role(_user_id)` responde a pergunta para qualquer um.
- **Escrita privilegiada é RPC `SECURITY DEFINER`**, com a checagem de
  permissão dentro da função. `authenticated` não ganha INSERT/UPDATE em
  tabela de papel, preço ou contato.
- **Nenhum fallback de credencial no código.** `src/lib/env.ts` lança erro se
  faltar variável. Um fallback faz um preview conversar com produção.
- **Segredo nunca tem prefixo `NEXT_PUBLIC_`** e só é lido de um módulo
  `server-only` (`src/lib/server/env.ts`).
- **Guarda de cron falha fechada** (`src/lib/server/internal.ts`).
- **Nada de copiar camada de segurança de outro app** (incluindo
  `imovel-connect-br`): copie o formato das telas, refaça a lógica.

## Antes de qualquer deploy

```bash
npm run verify     # typecheck + lint + db:test + db:mutate
```

- `npm run db:test` aplica `supabase/migrations/*.sql` num Postgres real
  (PGlite) e roda `supabase/tests/*.sql`. Sem Docker, sem projeto Supabase.
- `npm run db:mutate` reabre brechas conhecidas uma a uma e exige que o teste
  fique vermelho em todas. Uma mutação `BLIND` é um ponto cego do teste —
  conserte o teste, não a mutação.
- Toda regra nova de privacidade entra como verificação em
  `supabase/tests/` **e** como mutação em `scripts/db-mutate.mjs`.
