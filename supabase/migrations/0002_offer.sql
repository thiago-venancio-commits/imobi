-- =============================================================================
-- imobi — banco de oferta (§4, §6, §7, §12, §27, §35).
--
-- O imóvel vive em DUAS tabelas:
--   public.properties        metade pública. Sem preço, sem endereço exato,
--                            sem owner_id. É o que anon lê.
--   public.property_private  preço, mínimo aceitável, comissão, endereço,
--                            coordenada exata, dono. O comprador nunca lê.
--
-- A separação é o ponto. Se preço e descrição morassem na mesma linha, cada
-- política de leitura pública viraria uma lista de colunas a esconder, e a
-- primeira coluna esquecida vazaria o valor pelo PostgREST.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.property_type as enum (
  'casa', 'apartamento', 'cobertura', 'lote', 'terreno', 'comercial',
  'sala', 'loja', 'galpao', 'sitio', 'fazenda');

create type public.property_purpose as enum ('venda', 'locacao', 'venda_locacao');

create type public.property_condition as enum ('novo', 'usado', 'lancamento');

-- §27
create type public.property_status as enum (
  'aguardando_aprovacao', 'aprovado', 'publicado', 'reservado',
  'em_negociacao', 'vendido', 'alugado', 'pausado', 'rejeitado', 'cancelado');

-- §6: "a localização exata poderá ser protegida conforme configuração do Master"
create type public.location_precision as enum ('bairro', 'aproximado', 'exato');

create type public.media_kind as enum ('foto', 'video');

-- ---------------------------------------------------------------------------
-- Metade pública
-- ---------------------------------------------------------------------------
create sequence public.property_code_seq;

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    default 'IMB-' || lpad(nextval('public.property_code_seq')::text, 5, '0'),

  -- Identificação
  type public.property_type not null,
  purpose public.property_purpose not null,
  condition public.property_condition not null default 'usado',
  in_condominium boolean not null default false,

  -- Texto livre (passa pela máscara anti-contato)
  title text not null default '',
  description text not null default '',
  features text[] not null default '{}',
  amenities text[] not null default '{}',

  -- Medidas
  bedrooms smallint not null default 0 check (bedrooms >= 0),
  suites smallint not null default 0 check (suites >= 0),
  bathrooms smallint not null default 0 check (bathrooms >= 0),
  parking_spaces smallint not null default 0 check (parking_spaces >= 0),
  total_area numeric(10, 2) check (total_area is null or total_area > 0),
  built_area numeric(10, 2) check (built_area is null or built_area > 0),
  land_area numeric(10, 2) check (land_area is null or land_area > 0),
  -- A taxa de condomínio é despesa recorrente divulgada, não condição de
  -- negociação. Fica no lado público de propósito (§4 lista "condomínio,
  -- quando aplicável" entre o que o comprador pode ver).
  condo_fee numeric(10, 2) check (condo_fee is null or condo_fee >= 0),

  -- Localização aproximada. A exata está em property_private.
  city text not null default '',
  state char(2) not null default '',
  neighborhood text not null default '',
  approx_lat double precision,
  approx_lng double precision,
  location_precision public.location_precision not null default 'aproximado',
  landmarks text not null default '',

  -- Controle
  status public.property_status not null default 'aguardando_aprovacao',
  rejection_reason text,
  published_at timestamptz,
  views_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.properties (status);
create index on public.properties (city, state, neighborhood);
create index on public.properties (type, purpose);
create index on public.properties (published_at desc nulls last);

-- ---------------------------------------------------------------------------
-- Metade privada. Nenhuma coluna daqui aparece em página pública.
-- ---------------------------------------------------------------------------
create table public.property_private (
  property_id uuid primary key references public.properties (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,

  -- §4, §35: tudo que o comprador não pode ver
  price_sale numeric(14, 2) check (price_sale is null or price_sale >= 0),
  price_rent numeric(14, 2) check (price_rent is null or price_rent >= 0),
  min_price numeric(14, 2) check (min_price is null or min_price >= 0),
  down_payment numeric(14, 2) check (down_payment is null or down_payment >= 0),
  commercial_conditions text not null default '',
  commission_pct numeric(5, 2) check (commission_pct is null or commission_pct between 0 and 100),
  accepts_financing boolean not null default true,
  accepts_trade boolean not null default false,

  -- Endereço exato
  address text not null default '',
  street_number text not null default '',
  complement text not null default '',
  cep text not null default '',
  exact_lat double precision,
  exact_lng double precision,
  -- Deslocamento fixo por imóvel. Se fosse sorteado a cada leitura, bastava
  -- recarregar a página algumas vezes e tirar a média para achar o ponto real.
  geo_seed double precision not null default random(),

  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.property_private (owner_id);

create table public.property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  kind public.media_kind not null default 'foto',
  storage_path text not null,
  position smallint not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.property_media (property_id, position);
create unique index property_media_one_cover
  on public.property_media (property_id) where is_cover;

-- Documentos: bucket privado, só dono e Master.
create table public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  label text not null default '',
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index on public.property_documents (property_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Status em que o imóvel aparece no site público. Vendido, alugado, pausado,
-- rejeitado e cancelado somem da vitrine.
create or replace function private.property_is_public(_status public.property_status)
returns boolean language sql immutable set search_path = '' as $$
  select _status in ('publicado', 'reservado', 'em_negociacao')
$$;

create or replace function private.owns_property(_p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.property_private
    where property_id = _p and owner_id = auth.uid()
  )
$$;

grant execute on function
  private.property_is_public(public.property_status), private.owns_property(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Recalcula a coordenada pública a partir da exata, com deslocamento fixo de
-- até ~450 m. `location_precision = 'bairro'` não publica ponto nenhum.
create or replace function private.tg_property_approx_geo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  prec public.location_precision;
  angle double precision;
  radius double precision;
begin
  select location_precision into prec from public.properties where id = new.property_id;

  if new.exact_lat is null or new.exact_lng is null or prec = 'bairro' then
    update public.properties set approx_lat = null, approx_lng = null
     where id = new.property_id;
    return new;
  end if;

  if prec = 'exato' then
    update public.properties
       set approx_lat = new.exact_lat, approx_lng = new.exact_lng
     where id = new.property_id;
    return new;
  end if;

  angle := new.geo_seed * 2 * pi();
  radius := 0.004;  -- ~450 m
  update public.properties
     set approx_lat = new.exact_lat + radius * cos(angle),
         approx_lng = new.exact_lng + radius * sin(angle)
   where id = new.property_id;
  return new;
end $$;

create trigger property_private_approx_geo
  after insert or update of exact_lat, exact_lng on public.property_private
  for each row execute function private.tg_property_approx_geo();

-- Editar um imóvel já publicado devolve ele para aprovação. Sem isso, dava
-- para aprovar um anúncio limpo e depois enfiar um telefone na descrição.
-- O Master edita sem derrubar a publicação.
create or replace function private.tg_property_reapprove() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.is_master() then
    return new;
  end if;

  if new.status is distinct from old.status then
    return new;  -- mudança de status é tratada pelas RPCs
  end if;

  if private.property_is_public(old.status) and (
       new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.features is distinct from old.features
    or new.amenities is distinct from old.amenities
    or new.type is distinct from old.type
    or new.purpose is distinct from old.purpose
    or new.city is distinct from old.city
    or new.neighborhood is distinct from old.neighborhood
  ) then
    new.status := 'aguardando_aprovacao';
    new.published_at := null;
    insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
    values (auth.uid(), 'property.reapproval_required', 'property', new.id::text,
            jsonb_build_object('code', new.code));
  end if;

  return new;
end $$;

create trigger properties_reapprove before update on public.properties
  for each row execute function private.tg_property_reapprove();

create trigger properties_mask before insert or update on public.properties
  for each row execute function private.tg_mask_contacts('title', 'description', 'landmarks');

create trigger properties_touch before update on public.properties
  for each row execute function private.touch_updated_at();
create trigger property_private_touch before update on public.property_private
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.properties         enable row level security;
alter table public.property_private   enable row level security;
alter table public.property_media     enable row level security;
alter table public.property_documents enable row level security;

-- properties: o site público lê os imóveis publicados; o dono lê os seus; o
-- Master e os corretores autorizados leem tudo (precisam para atender).
create policy properties_select_public on public.properties
  for select to anon, authenticated
  using (private.property_is_public(status));

create policy properties_select_own on public.properties
  for select to authenticated
  using (
    (select private.owns_property(id))
    or (select private.is_master())
    or (select private.is_active_broker())
  );

-- Não existe policy de INSERT: o imóvel nasce pela RPC create_property(), que
-- cria as duas metades numa transação só. Um INSERT direto não teria como
-- funcionar de qualquer jeito — a posse mora em property_private, então o
-- dono não passaria pela própria policy de SELECT no RETURNING.

create policy properties_update_own on public.properties
  for update to authenticated
  using ((select private.owns_property(id)) or (select private.is_master()))
  with check ((select private.owns_property(id)) or (select private.is_master()));

-- property_private: dono e Master. O corretor entra na migration de leads,
-- e só para imóvel em que ele tenha lead ativo.
create policy property_private_select on public.property_private
  for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_master()));

create policy property_private_update on public.property_private
  for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_master()))
  with check (owner_id = (select auth.uid()) or (select private.is_master()));

-- Mídia acompanha a visibilidade do imóvel.
create policy property_media_select_public on public.property_media
  for select to anon, authenticated
  using (exists (
    select 1 from public.properties p
    where p.id = property_id and private.property_is_public(p.status)));

create policy property_media_select_own on public.property_media
  for select to authenticated
  using ((select private.owns_property(property_id))
         or (select private.is_master())
         or (select private.is_active_broker()));

create policy property_media_write_own on public.property_media
  for all to authenticated
  using ((select private.owns_property(property_id)) or (select private.is_master()))
  with check ((select private.owns_property(property_id)) or (select private.is_master()));

-- Documentos nunca são públicos.
create policy property_documents_rw_own on public.property_documents
  for all to authenticated
  using ((select private.owns_property(property_id)) or (select private.is_master()))
  with check ((select private.owns_property(property_id)) or (select private.is_master()));

-- ---------------------------------------------------------------------------
-- GRANTs
-- ---------------------------------------------------------------------------
revoke all on public.properties, public.property_private, public.property_media,
  public.property_documents from anon, authenticated;

grant select on public.properties to anon, authenticated;
grant select on public.property_media to anon, authenticated;

-- O dono escreve conteúdo público, nunca `status`, `published_at`, `code`,
-- `views_count` nem `location_precision` (esta é configuração do Master, §6).
-- INSERT não é concedido: ver create_property().
grant update (type, purpose, condition, in_condominium, title, description,
  features, amenities, bedrooms, suites, bathrooms, parking_spaces,
  total_area, built_area, land_area, condo_fee, city, state, neighborhood,
  landmarks) on public.properties to authenticated;

grant select on public.property_private to authenticated;
grant update (price_sale, price_rent, min_price, down_payment,
  commercial_conditions, accepts_financing, accepts_trade, address,
  street_number, complement, cep, exact_lat, exact_lng, internal_notes)
  on public.property_private to authenticated;

grant select, insert, update, delete on public.property_media to authenticated;
grant select, insert, update, delete on public.property_documents to authenticated;

-- `commission_pct` fica de fora: comissão é informação interna da operação
-- (§47), definida pelo Master, não pelo proprietário.

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Cria o rascunho do imóvel: as duas metades, numa transação só, com a posse
-- vinda de auth.uid(). O cliente depois preenche as colunas por UPDATE, que
-- as policies já cobrem.
--
-- Precisa ser RPC, e não INSERT direto, porque quem é dono está em
-- property_private: no RETURNING de um INSERT a linha ainda não teria dono e
-- o próprio criador esbarraria na policy de SELECT.
create or replace function public.create_property(
  _type public.property_type,
  _purpose public.property_purpose,
  _title text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not private.is_approved_owner() then
    raise exception 'owner_not_approved' using errcode = '42501';
  end if;
  if not private.caller_active() then
    raise exception 'user_blocked' using errcode = '42501';
  end if;

  insert into public.properties (type, purpose, title)
  values (_type, _purpose, coalesce(_title, ''))
  returning id into v_id;

  insert into public.property_private (property_id, owner_id)
  values (v_id, auth.uid());

  perform private.log_audit('property.created', 'property', v_id::text, '{}');
  return v_id;
end $$;

-- RPCs de status (§27). Transição é decisão do Master.
create or replace function public.set_property_status(
  _property uuid, _status public.property_status, _reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_master() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.properties
     set status = _status,
         rejection_reason = case when _status = 'rejeitado' then _reason else null end,
         published_at = case
           when _status = 'publicado' then coalesce(published_at, now())
           when _status in ('aguardando_aprovacao', 'rejeitado', 'cancelado') then null
           else published_at end
   where id = _property;

  if not found then
    raise exception 'property_not_found' using errcode = 'P0002';
  end if;

  perform private.log_audit('property.status', 'property', _property::text,
    jsonb_build_object('status', _status, 'reason', _reason));
end $$;

-- O Master decide quanto da localização vai ao ar (§6).
create or replace function public.set_property_location_precision(
  _property uuid, _precision public.location_precision)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_master() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.properties set location_precision = _precision where id = _property;

  -- Recalcula a coordenada pública com a nova regra.
  update public.property_private
     set exact_lat = exact_lat, exact_lng = exact_lng
   where property_id = _property;

  perform private.log_audit('property.location_precision', 'property', _property::text,
    jsonb_build_object('precision', _precision));
end $$;

create or replace function public.set_property_commission(_property uuid, _pct numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_master() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.property_private set commission_pct = _pct where property_id = _property;
  perform private.log_audit('property.commission', 'property', _property::text,
    jsonb_build_object('pct', _pct));
end $$;

-- O dono devolve o imóvel para a fila de aprovação depois de editar o rascunho.
create or replace function public.submit_property(_property uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.owns_property(_property) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.properties
     set status = 'aguardando_aprovacao', rejection_reason = null
   where id = _property
     and status in ('rejeitado', 'pausado', 'aguardando_aprovacao');

  perform private.log_audit('property.submitted', 'property', _property::text, '{}');
end $$;

-- Contador de visualizações (§33). Não revela nada e pode ser chamado por anon.
create or replace function public.register_property_view(_property uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.properties set views_count = views_count + 1
   where id = _property and private.property_is_public(status);
end $$;

grant execute on function
  public.create_property(public.property_type, public.property_purpose, text),
  public.set_property_status(uuid, public.property_status, text),
  public.set_property_location_precision(uuid, public.location_precision),
  public.set_property_commission(uuid, numeric),
  public.submit_property(uuid)
to authenticated;

grant execute on function public.register_property_view(uuid) to anon, authenticated;
