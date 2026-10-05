-- =============================================================================
-- imobi — núcleo: identidade, papéis, contatos privados, auditoria, máscara.
--
-- Princípio: as regras absolutas do projeto (§3, §4, §13, §14, §47) não são
-- regras de tela. O contato e o preço ficam em tabelas que a outra parte não
-- consegue ler. Uma página pública não vaza o que a fonte de dados não tem.
--
-- Derivado do kit supabase-multitenant-saas v0.1, sem a camada de organizações:
-- aqui o operador é único (um Master).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- `private` fica fora dos schemas expostos pelo PostgREST: nada aqui é
-- chamável como RPC. As policies chamam estas funções como o papel que
-- consulta, por isso `authenticated` precisa de USAGE.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.user_status as enum ('ativo', 'bloqueado');
create type public.broker_status as enum ('pendente', 'autorizado', 'bloqueado', 'removido');
create type public.owner_status as enum ('pendente', 'aprovado', 'bloqueado');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

-- Perfil público mínimo. O mesmo usuário pode ser comprador E proprietário.
-- Não guarda telefone, e-mail pessoal nem documento: isso é `contacts`.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  status public.user_status not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dados de contato. A tabela inteira é invisível para qualquer usuário que
-- não seja o dono. O corretor nunca faz SELECT aqui: ele usa reveal_contact()
-- (migration de leads), que confere o vínculo e grava auditoria.
create table public.contacts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  whatsapp text,
  cpf_cnpj text,
  address text,
  city text,
  state text,
  cep text,
  updated_at timestamptz not null default now()
);

-- O Master. Nada no aplicativo escreve nesta tabela: a linha entra por seed
-- ou pelo dashboard. (Invariante 2 do kit: papel de plataforma nunca é
-- concedido por um fluxo do app, senão qualquer cadastro vira administrador.)
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Corretor autorizado. Escrita só por RPC do Master.
create table public.brokers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  creci text,
  phone text,
  bio text,
  status public.broker_status not null default 'pendente',
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.brokers (status);

-- Proprietário. O Master aprova antes de o imóvel poder ser publicado.
create table public.owner_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status public.owner_status not null default 'pendente',
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.owner_profiles (status);

-- Trilha de auditoria. Quem revelou um contato, quem aprovou o quê, quem
-- tentou mandar telefone numa mensagem.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.audit_log (created_at desc);
create index on public.audit_log (actor_id, created_at desc);
create index on public.audit_log (action, created_at desc);

-- Configuração da operação. Linha única.
create table public.site_settings (
  id boolean primary key default true check (id),
  -- O botão WhatsApp do site aponta SEMPRE para este número (o do Master),
  -- nunca para o do proprietário.
  master_whatsapp text not null default '',
  master_email text not null default '',
  -- Tolerância do match sobre o orçamento (§11). Ver nota em 0003.
  match_budget_tolerance_pct integer not null default 10
    check (match_budget_tolerance_pct between 0 and 100),
  -- Quantas vezes o comprador pode mexer no orçamento por dia. Sem limite,
  -- dá para descobrir o preço por busca binária.
  demand_budget_edits_per_day integer not null default 5
    check (demand_budget_edits_per_day > 0),
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (true);

-- ---------------------------------------------------------------------------
-- Helpers privados. Nenhum recebe id de usuário: eles sempre querem dizer
-- "quem está chamando". Um helper que aceita `_user_id` responde a pergunta
-- para qualquer um (trap #7 do registro do kit).
-- ---------------------------------------------------------------------------

create or replace function private.is_master() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

create or replace function private.is_active_broker() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.brokers
    where user_id = auth.uid() and status = 'autorizado'
  )
$$;

create or replace function private.is_approved_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.owner_profiles
    where user_id = auth.uid() and status = 'aprovado'
  )
$$;

-- Usuário bloqueado perde o acesso de escrita sem precisar de logout.
create or replace function private.caller_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select status = 'ativo' from public.profiles where id = auth.uid()),
    false)
$$;

create or replace function private.log_audit(
  _action text, _target_type text, _target_id text, _metadata jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), _action, _target_type, _target_id, coalesce(_metadata, '{}'))
$$;

-- ---------------------------------------------------------------------------
-- Máscara anti-contato (§34)
--
-- Remove telefone, e-mail, link e @handle de qualquer texto livre que uma
-- parte escreve para a outra. É aplicada por trigger, não pelo frontend:
-- o PostgREST aceita escrita direta, então a limpeza tem que ser do banco.
-- ---------------------------------------------------------------------------

create or replace function private.mask_contacts(_t text) returns text
language sql immutable set search_path = '' as $$
  select case when _t is null then null else
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
      _t,
      -- e-mail (primeiro: contém @ e pontos que os outros padrões comeriam)
      '[A-Za-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[A-Za-z0-9.-]+\.[A-Za-z]{2,}',
      '[contato removido]', 'gi'),
      -- URL, incluindo wa.me e encurtadores
      '((https?://|www\.)[^\s]+|\m[a-z0-9-]+\.(com|net|org|br|me|io|co)(\.[a-z]{2})?/[^\s]*)',
      '[link removido]', 'gi'),
      -- telefone BR: opcional +55, DDD, 8 ou 9 dígitos com separadores
      '(\+?\s*55)?\s*\(?\s*[1-9]{2}\s*\)?[\s.-]*9?[\s.-]*[0-9]{4}[\s.-]*[0-9]{4}\y',
      '[telefone removido]', 'g'),
      -- qualquer corrida de 8+ dígitos (telefone escrito de forma criativa)
      '\m[0-9][0-9\s.-]{6,}[0-9]\y',
      '[número removido]', 'g'),
      -- @handle de rede social
      '(^|\s)@[A-Za-z0-9._]{3,}',
      '\1[perfil removido]', 'g')
  end
$$;

-- True quando a máscara mudou alguma coisa, ou seja: o texto tinha contato.
create or replace function private.has_contact_info(_t text) returns boolean
language sql immutable set search_path = '' as $$
  select _t is not null and private.mask_contacts(_t) is distinct from _t
$$;

-- Trigger genérico. Recebe os nomes das colunas de texto a limpar:
--   create trigger ... execute function private.tg_mask_contacts('titulo','descricao');
-- SECURITY DEFINER porque ela grava em audit_log, onde `authenticated` não
-- tem INSERT. A função não lê nada do chamador além da linha que ele já está
-- gravando, então não abre caminho para ler dado de outro usuário.
create or replace function private.tg_mask_contacts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  col text;
  original text;
  cleaned text;
  flagged boolean := false;
begin
  foreach col in array tg_argv loop
    execute format('select ($1).%I::text', col) into original using new;
    cleaned := private.mask_contacts(original);
    if cleaned is distinct from original then
      flagged := true;
      new := jsonb_populate_record(new, jsonb_build_object(col, cleaned));
    end if;
  end loop;

  if flagged then
    insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
    values (auth.uid(), 'contact.masked', tg_table_name,
            coalesce((to_jsonb(new) ->> 'id'), ''),
            jsonb_build_object('columns', to_jsonb(tg_argv)));
  end if;

  return new;
end $$;

revoke all on all functions in schema private from public, anon;
grant execute on function
  private.is_master(), private.is_active_broker(), private.is_approved_owner(),
  private.caller_active(), private.mask_contacts(text), private.has_contact_info(text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers de ciclo de vida
-- ---------------------------------------------------------------------------

-- O cadastro cria APENAS o perfil. Nenhum papel é concedido aqui: virar
-- proprietário, corretor ou Master é um passo separado e aprovado.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger contacts_touch before update on public.contacts
  for each row execute function private.touch_updated_at();
create trigger site_settings_touch before update on public.site_settings
  for each row execute function private.touch_updated_at();

-- O nome aparece para a outra parte em alguns painéis, então também passa
-- pela máscara: "João (31) 99999-0000" não vira um canal de contato.
create trigger profiles_mask before insert or update on public.profiles
  for each row execute function private.tg_mask_contacts('full_name');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.contacts        enable row level security;
alter table public.platform_admins enable row level security;
alter table public.brokers         enable row level security;
alter table public.owner_profiles  enable row level security;
alter table public.audit_log       enable row level security;
alter table public.site_settings   enable row level security;

-- profiles: cada um vê o seu; o Master vê todos.
-- (O corretor ganha acesso aos nomes dos seus leads na migration de leads,
-- com uma policy que exige o vínculo.)
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_master()));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- contacts: o dono e o Master. Mais ninguém, nunca.
create policy contacts_rw_self on public.contacts
  for all to authenticated
  using (user_id = (select auth.uid()) or (select private.is_master()))
  with check (user_id = (select auth.uid()));

-- platform_admins: cada um só enxerga a própria linha. Quem não é Master lê
-- zero linhas e nem descobre quantos existem.
create policy platform_admins_select_self on public.platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- brokers: o próprio corretor vê sua linha; o Master vê todas.
-- A ficha pública do corretor sai por view na migration de leads.
create policy brokers_select_self on public.brokers
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_master()));

-- A candidatura é o único INSERT que o usuário faz, e sempre como 'pendente'.
create policy brokers_apply_self on public.brokers
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pendente'
    and (select private.caller_active())
  );

create policy owner_profiles_select_self on public.owner_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_master()));

create policy owner_profiles_apply_self on public.owner_profiles
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pendente'
    and (select private.caller_active())
  );

-- audit_log: só o Master lê. Escrita é só por SECURITY DEFINER.
create policy audit_log_select_master on public.audit_log
  for select to authenticated
  using ((select private.is_master()));

-- site_settings: todo mundo lê (o botão WhatsApp é público), só o Master escreve.
create policy site_settings_select_all on public.site_settings
  for select to anon, authenticated using (true);
create policy site_settings_update_master on public.site_settings
  for update to authenticated
  using ((select private.is_master()))
  with check ((select private.is_master()));

-- ---------------------------------------------------------------------------
-- GRANTs
--
-- O PostgREST expõe toda permissão que existir, não só o que a tela usa.
-- Por isso a base é tirar tudo e devolver coluna a coluna.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.contacts, public.platform_admins,
  public.brokers, public.owner_profiles, public.audit_log, public.site_settings
  from anon, authenticated;

grant select on public.site_settings to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

grant select, insert, update, delete on public.contacts to authenticated;

grant select on public.platform_admins to authenticated;
grant select on public.brokers to authenticated;
grant insert (user_id, creci, phone, bio, status) on public.brokers to authenticated;
grant select on public.owner_profiles to authenticated;
grant insert (user_id, status) on public.owner_profiles to authenticated;
grant select on public.audit_log to authenticated;

-- `status` continua sem UPDATE para authenticated: nem corretor nem
-- proprietário se auto-aprovam. Quem muda é RPC do Master.

-- ---------------------------------------------------------------------------
-- RPCs públicas
-- ---------------------------------------------------------------------------

-- Wrappers finos. Respondem só sobre quem chama, então não vazam nada.
create or replace function public.is_master() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_master()
$$;

create or replace function public.is_active_broker() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_broker()
$$;

create or replace function public.my_roles()
returns table (is_master boolean, is_broker boolean, is_owner boolean, broker_status public.broker_status, owner_status public.owner_status)
language sql stable security definer set search_path = '' as $$
  select
    private.is_master(),
    private.is_active_broker(),
    private.is_approved_owner(),
    (select status from public.brokers where user_id = auth.uid()),
    (select status from public.owner_profiles where user_id = auth.uid())
$$;

-- Decisões do Master sobre corretores e proprietários.
create or replace function public.set_broker_status(_user uuid, _status public.broker_status)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_master() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.brokers
     set status = _status, decided_at = now(), decided_by = auth.uid()
   where user_id = _user;
  if not found then
    raise exception 'broker_not_found' using errcode = 'P0002';
  end if;
  perform private.log_audit('broker.status', 'broker', _user::text,
    jsonb_build_object('status', _status));
end $$;

create or replace function public.set_owner_status(_user uuid, _status public.owner_status)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_master() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.owner_profiles
     set status = _status, decided_at = now(), decided_by = auth.uid()
   where user_id = _user;
  if not found then
    raise exception 'owner_not_found' using errcode = 'P0002';
  end if;
  perform private.log_audit('owner.status', 'owner', _user::text,
    jsonb_build_object('status', _status));
end $$;

create or replace function public.set_user_status(_user uuid, _status public.user_status)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_master() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if _user = auth.uid() then
    raise exception 'cannot_block_self' using errcode = '22023';
  end if;
  update public.profiles set status = _status where id = _user;
  perform private.log_audit('user.status', 'user', _user::text,
    jsonb_build_object('status', _status));
end $$;

-- Nenhuma função do schema public é executável por padrão. Cada uma é
-- liberada explicitamente abaixo.
revoke execute on all functions in schema public from public, anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;

grant execute on function
  public.is_master(), public.is_active_broker(), public.my_roles(),
  public.set_broker_status(uuid, public.broker_status),
  public.set_owner_status(uuid, public.owner_status),
  public.set_user_status(uuid, public.user_status)
to authenticated;
