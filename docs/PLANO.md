# imobi — Plataforma de Intermediação Imobiliária (MVP)

## Contexto
O repo `imobi` está vazio (só `.git`, sem remote). A especificação (48 seções + a lista de 15 itens da imagem) descreve uma plataforma com **um único operador**, em que o Master controla tudo. Proprietário e comprador nunca se veem, e o preço nunca aparece para o comprador.

Decisões já tomadas:
- **Operador único**: um Master, corretores, compradores e proprietários, sem multi-imobiliária.
- **Next.js**: as páginas de imóvel precisam aparecer no Google e gerar prévia própria no WhatsApp.
- **Supabase + Vercel**: as contas já existem.

A regra que guia todo o desenho: **o preço e os contatos não ficam escondidos na tela. Eles estão em tabelas que o comprador ou o proprietário não conseguem ler.** O HTML público não tem como vazar o que a fonte de dados não contém.

---

## Respostas às suas perguntas

**1. Usar a skill `supabase-multitenant-saas`?** Sim, mas só em parte.
- Usamos as invariantes de segurança:
  - RLS que deriva a identidade do token.
  - Helpers no schema `private`, sem parâmetro de user-id.
  - Toda escrita privilegiada via RPC `SECURITY DEFINER`.
  - `platform_admins` (que aqui é o Master), inserido só por seed.
  - Client que lê tudo do ambiente, sem fallback.
  - `getCaller` e `requireInternal` (fail closed).
  - Resend para email (SMTP do Auth + emails do app).
  - Teste de isolamento com PGlite: `run.mjs` e `mutate.mjs`.
- **Não usamos** organizations, memberships, assentos e planos, porque o operador é único.
- O padrão de convite por token (sha256 + email confirmado) vira o **convite de corretor**.
- O `frontend.md` é para Vite. Traduzo para Next.js com `@supabase/ssr`.

**2. Skills globais que vamos usar**

| Quando | Skill |
|---|---|
| Banco e segurança | `supabase-multitenant-saas` (acima) |
| Vercel link e env | `vercel-project-link` (token `VERCEL_TOKEN_IMOBI`, nunca `vercel login`), `vercel:env` |
| Código | `vercel:nextjs`, `vercel:shadcn`, `vercel:react-best-practices` |
| Deploy e teste | `vercel:deploy`, `vercel:verification`, `vercel:vercel-firewall` (rate limit em cadastro e "Tenho interesse") |
| Qualidade | `security-review` / `code-review` antes de cada deploy em produção, `engineering:testing-strategy` |
| UX | `design:ux-copy` (textos pt-BR), `design:accessibility-review` |
| Relatórios do Master | `dataviz` |
| Entrega (fim do MVP) | `stack-replication-manual` (manual do programador), `investor-handoff-report` (relatório para o cliente) |
| Fora do MVP | `whatsapp-bitrix24-connector` (só se a fase 2 tiver WhatsApp Cloud API), `vercel:ai-*` (fase 6) |

**3. Railway? Cloudflare?**
- **Railway: não.**
  - Vercel cobre o site e o código de servidor.
  - Supabase cobre banco, auth, storage, realtime e pg_cron.
  - Railway só entraria se houvesse um processo sempre ligado (por exemplo um bot WhatsApp não oficial), e não há.
- **Cloudflare: não para hospedagem.**
  - Só usamos o **Turnstile** (captcha grátis), que o Supabase Auth suporta nativamente, no cadastro e nos formulários públicos.
  - O DNS fica onde o domínio estiver (por exemplo Registro.br), apontando para a Vercel.
  - Se o volume de vídeo crescer, avaliar R2 ou Stream depois.

**4. Link de autenticação do MCP.**
- Esta sessão não consegue rodar o OAuth, então não dá para gerar o link daqui. O link aparece no momento em que você autentica.
- Sigo o padrão do juriscape: um conector por projeto, fixado no project_ref (passos na Etapa 0).
- Os conectores de conta inteira "claude.ai Supabase" e "plugin:vercel" ficam **sem autenticar**. Eles enxergam todos os seus projetos, e a regra é nunca apontar o MCP de um projeto para outro.

**5. `imovel-connect-br` (wiseflaviosilva-ai)**
- **Reaproveitar:**
  - `src/services/brazilian-apis.service.ts` (ViaCEP + IBGE estados/municípios), quase sem mudanças.
  - O formato (campos e telas) de `PropertyRegistrationForm`, `ListingForm`, `DocumentUpload`, `SellerApprovalManagement` e `AdminActionsLog`. A lógica é refeita do zero.
- **Não reaproveitar:** web3, tokenização, IPFS e o contrato `.sol`, além de `AuthContext`, `has_role` e as RLS. A regra nº 1 do kit é nunca copiar a camada de segurança de outro app.
- **Achados de segurança no repo** (confirmar se o projeto `fqypnhjxsgpcgebxjquv` ainda está no ar):
  - `bulk_update_property_status(..., admin_user_id)` confia no parâmetro (trap #7).
  - `has_role(_user_id)` aceita qualquer ID.
  - Anon key fixa no código (trap #12).
  - `VITE_PINATA_SECRET_KEY`.
  - `.env` versionado.

---

## Stack
- **Next.js 16** (App Router, TypeScript), Tailwind, shadcn/ui, `@supabase/ssr`, Zod, react-hook-form. A sessão é renovada em `proxy.ts`.
- **Supabase** em `sa-east-1` (São Paulo): Postgres, Auth (email + senha, captcha Turnstile), Storage, Realtime, pg_cron.
  - Produção precisa do **plano Pro**: o Free pausa após 7 dias sem uso e limita arquivos a 50 MB, pouco para vídeo.
- **Vercel**: runtime Node, região `gru1`. Vercel Cron cuida do envio de emails pendentes.
- **Resend**: email (precisa do domínio do site).
- **Mapa**: Leaflet + OpenStreetMap, com círculo aproximado. As coordenadas públicas já vêm deslocadas do banco.
- **Fotos e vídeos**:
  - A foto é recomprimida no navegador antes do upload. Isso **remove o EXIF/GPS**, que revelaria o endereço exato.
  - Vídeo mp4 até 100 MB.
  - Exibição via `next/image`.
- **Sem Supabase Edge Functions no MVP.**
  - Server Actions e Route Handlers fazem o papel delas.
  - O `getCaller` do kit vira `lib/server/caller.ts`, com `auth.getUser()` pelo cookie.
  - O `requireInternal` vira `lib/server/internal.ts`, que confere o `CRON_SECRET` e falha fechado.
  - A chave secreta fica num módulo `server-only` e nunca tem prefixo `NEXT_PUBLIC_`.

---

## Etapa 0 — Infra e MCP (você faz os itens marcados com 👤)
1. 👤 **GitHub**: criar o repo `imobi`. Defina a conta: `franklinbiz` ou `wiseflaviosilva-ai`.
2. 👤 **Supabase**:
   - Criar o projeto `imobi` na região São Paulo e me passar o **project ref**.
   - Criar um token em https://supabase.com/dashboard/account/tokens, logado **na conta deste projeto**.
   - Rodar `setx SUPABASE_ACCESS_TOKEN_IMOBI "sbp_..."`.
3. 👤 **Vercel**:
   - Criar um token em https://vercel.com/account/settings/tokens (escopo: o time do projeto).
   - Rodar `setx VERCEL_TOKEN_IMOBI "..."`.
4. Eu crio o `.mcp.json` no repo (`${VAR}` é expandido do ambiente, então nenhum segredo vai para o código):
   ```json
   { "mcpServers": {
       "supabase-imobi": { "type": "http",
         "url": "https://mcp.supabase.com/mcp?project_ref=<REF>",
         "headers": { "Authorization": "Bearer ${SUPABASE_ACCESS_TOKEN_IMOBI}" } },
       "vercel-imobi": { "type": "http", "url": "https://mcp.vercel.com" } } }
   ```
5. 👤 **Reiniciar o VS Code**, para as variáveis novas chegarem ao MCP. Depois:
   - Rodar `/mcp`, escolher `vercel-imobi` e clicar em **Authenticate**. Esse é o link de autenticação: o navegador abre o login OAuth da Vercel.
   - O Supabase autentica pelo token, sem link.
6. 👤 **Resend**: domínio do site e registros DNS. Até lá, uso o remetente de teste.
7. Eu:
   - `vercel link` + `env pull` via `vercel-project-link`.
   - Salvo a memória do projeto: decisões, project ref, nomes dos tokens.
   - Ajusto o `.gitignore` (`.env*`, `!.env.example`, `*.txt` de credenciais).

---

## Modelo de dados (o núcleo da privacidade)

**Papéis** (invariante 2 do kit: papéis da plataforma nunca se misturam com os do app)
- `platform_admins`: o **Master**. Só seed insere; nada no app concede esse papel.
- `brokers(user_id, creci, status: pendente|autorizado|bloqueado|removido)`: escrito **só por RPCs do Master**. Há dois caminhos:
  - O Master convida (`broker_invitations`: token sha256 + email confirmado).
  - O corretor se candidata em `/seja-corretor`, e o Master aprova ou reprova.
- `profiles(id, full_name, status: ativo|bloqueado)`: o mesmo usuário pode ser comprador **e** proprietário.
- `owner_profiles(user_id, status: pendente|aprovado|bloqueado)`: o Master aprova o proprietário.
- `contacts(user_id, phone, whatsapp, cpf, address)` **privado**:
  - Leem: o próprio usuário e o Master.
  - O corretor **não faz SELECT**. Ele usa `reveal_contact(lead, 'buyer'|'owner')`, que confere se o lead é dele e grava `audit_log`.

**Oferta: tabela pública × tabela privada**
- `properties` (**só colunas públicas**):
  - Identificação: code `IMB-00123`, tipo, finalidade, condição (novo/usado/lançamento), em_condominio.
  - Texto: título, descrição, características, comodidades.
  - Medidas: quartos, suítes, banheiros, vagas, área, área construída, área do terreno, taxa de condomínio.
  - Local: cidade, UF, bairro, `approx_lat/lng`, precisão (bairro, aproximado ou exato, definida pelo Master).
  - Controle: status (os 10 da §27), published_at, views.
  - **Não tem `owner_id`, preço nem endereço exato.**
- `property_private(property_id, owner_id, price_sale, price_rent, min_price, down_payment, conditions, commission_pct, address, number, cep, exact_lat/lng, internal_notes)`:
  - RLS: dono, Master e corretor com lead ativo no imóvel.
  - **Nunca o comprador.**
- `property_media` usa o bucket público `property-media`. Só o dono ou o Master gravam em `{property_id}/…`.
- `property_documents` usa o bucket **privado** `property-docs` (dono + Master).
- Status: o cadastro entra como `aguardando_aprovacao`. **Editar um imóvel publicado devolve ele para aprovação**, para que não dê para enfiar telefone na descrição depois de aprovado.

**Demanda e matching**
- `demands(buyer_id, finalidade, tipos[], cidade, bairros[], mínimos de quartos/suítes/banheiros/vagas, área mín/máx, orçamento mín/máx, forma de pagamento, financiamento, características[], obs, ativa)`:
  - Leem: o comprador, o Master e o corretor do lead.
  - O proprietário nunca lê.
- `matches(demand_id, property_id, score, seen_at, dismissed)`:
  - Escrito só por `private.compute_matches_*`, disparado quando um imóvel é publicado ou uma demanda é criada ou alterada.
  - O comprador vê só os dados públicos do imóvel.
- **Proteção contra descobrir o preço por tentativa:**
  - A busca pública **não tem filtro nem ordenação por preço**.
  - O match compara o orçamento com margem de tolerância (padrão ±10%, configurável).
  - Alterações de orçamento são limitadas por dia. Sem isso, o comprador acharia o preço fazendo busca binária no orçamento.
- `favorites(buyer_id, property_id)`.

**Intermediação**
- `interests` → trigger cria ou atualiza o `lead` e notifica o Master.
- `leads(buyer_id, property_id, demand_id, stage, assigned_to, assigned_by)`:
  - `stage` é um enum com as 16 etapas da §19.
  - Histórico em `lead_assignments` + `lead_events`.
  - RPCs `assign_lead`, `transfer_lead` e `move_lead_stage`, só para Master. O corretor só move etapas dos próprios leads.
- `proposals(lead_id, amount, kind: proposta|contraproposta, origin: comprador|proprietario, status: enviada|encaminhada|aceita|recusada|substituida)`:
  - O comprador cria.
  - O Master ou o corretor **encaminha** ao proprietário.
  - O proprietário responde.
  - O proprietário vê o comprador só como **"Interessado #A12"**.
- `visits(lead_id, property_id, scheduled_at, broker_id, status, notes, result)`.
- `threads(kind: comprador_equipe|proprietario_equipe)` + `messages`: **nunca** existe thread entre comprador e proprietário.
- **Máscara anti-contato** `private.mask_contacts(text)`:
  - É um trigger em mensagens, título e descrição do imóvel, observações da demanda, interesse e proposta.
  - Mascara telefone BR, email, `wa.me`, links e @handles.
  - Marca `flagged` e grava `audit_log`.
- `notifications(user_id, type, payload, read_at, email_status)`:
  - Triggers inserem; o realtime mostra no app.
  - Um cron na Vercel envia por Resend.
- `site_settings`:
  - Número do Master para o **botão WhatsApp**: link `wa.me` com "Tenho interesse no IMB-00123", **nunca do proprietário**.
  - Também guarda a tolerância do match e a precisão de localização padrão.
- Do kit: `audit_log`, `email_log`.

Helpers em `private` (sem parâmetro de usuário; usam `auth.uid()` por dentro): `is_master()`, `is_active_broker()`, `owns_property(_p)`, `broker_on_property(_p)`, `broker_on_buyer(_b)`. Mais `revoke execute ... from public, anon` como padrão, igual ao `schema.sql` do kit.

---

## Rotas
- **Público:** `/`, `/imoveis` (filtros sem preço), `/imoveis/[code]` (SSR + `generateMetadata` com foto de capa para a prévia do WhatsApp, "VALOR SOB CONSULTA", **TENHO INTERESSE**), `/procuro-imovel`, `/anunciar`, `/seja-corretor`, `/entrar`, `/cadastro`, `/auth/confirm`, `/auth/reset`, `/convite-corretor/[token]`.
- **Comprador** `/minha-conta/*`: perfil, demandas, compatíveis, favoritos, interesses, visitas, propostas, mensagens.
- **Proprietário** `/proprietario/*`: imóveis (novo/editar/status), interessados (contagem), propostas, visitas, mensagens.
- **Corretor** `/corretor/*`: leads, compradores, imóveis, agenda, visitas, propostas, mensagens.
- **Master** `/master/*`: dashboard, aprovações (imóveis, proprietários, corretores), compradores, proprietários, demandas, matches, leads (kanban de 16 etapas + distribuir/transferir), corretores, negociações, relatórios, configurações, auditoria.
- O layout de cada área confere o papel no servidor, e o banco também recusa. A UI só esconde o que o usuário não pode usar.

---

## Marcos
- **M1 Base:**
  - Scaffold Next.js + shadcn.
  - Clientes Supabase em `lib/supabase/{server,client}.ts`, que lançam erro se faltar env.
  - Auth: cadastro, login, confirmação, reset, Turnstile.
  - Migration núcleo: papéis, `contacts`, helpers `private`, `mask_contacts`, auditoria.
  - Harness de teste PGlite copiado de `scripts/run.mjs` do kit.
- **M2 Oferta:**
  - Cadastro do imóvel pelo proprietário (ViaCEP, upload sem EXIF, documentos).
  - Aprovação pelo Master.
  - Listagem pública e página SSR, mapa aproximado, botão WhatsApp do Master.
- **M3 Demanda:** "Procuro imóvel", matching, favoritos, alerta "Encontramos um imóvel compatível".
- **M4 Leads:**
  - TENHO INTERESSE → lead → Master distribui ou transfere.
  - Painel do corretor, `reveal_contact`, kanban do CRM.
- **M5 Negociação:** propostas e contrapropostas encaminhadas, visitas, mensagens com máscara, painéis de proprietário e comprador.
- **M6 Fechamento:** emails, relatórios, auditoria, revisão de segurança, deploy de produção e manual de handoff.

Cada marco termina com teste de isolamento verde, deploy de preview e um commit.

---

## Verificação
1. **Teste de isolamento por papel** (`supabase/tests/role-isolation.sql`, adaptado do `isolation-test.sql` do kit). Personas: anon, comprador, proprietário, corretor A, corretor B e Master. Cada item abaixo precisa passar:
   - Anon e comprador leem 0 linhas de `property_private` e `contacts`.
   - O proprietário não lê demanda, interesse nem contato do comprador.
   - O corretor B não lê lead nem contato do corretor A, e `reveal_contact` recusa.
   - Ninguém se promove a Master ou corretor.
   - Editar um imóvel publicado volta para aprovação.
   - `mask_contacts` pega "(31) 99999-8888", "fulano@gmail.com" e "wa.me/55…".
   - Roda localmente com PGlite (`run.mjs` + `mutate.mjs` com mutações para cada regra) e depois no projeto via MCP `execute_sql`.
2. MCP `get_advisors` (security + performance): sem avisos.
3. **Teste de vazamento no HTML**: buscar `/imoveis/[code]` como anon e procurar, inclusive no payload RSC, o preço e o telefone do dono. Os dois têm de estar ausentes. Também chamar o PostgREST com a anon key: `property_private` deve voltar `[]` e `rpc/reveal_contact` deve dar 401/403.
4. **Fluxo manual no preview da Vercel:**
   1. O proprietário cadastra o imóvel e o Master aprova.
   2. O comprador cria uma demanda e recebe o alerta de match.
   3. O comprador clica em TENHO INTERESSE e o Master atribui ao corretor.
   4. O corretor revela o contato (gera registro de auditoria).
   5. Proposta, encaminhamento, contraproposta, fechado.
   6. Em cada tela, confirmar que nenhuma parte vê o contato ou o preço da outra.
