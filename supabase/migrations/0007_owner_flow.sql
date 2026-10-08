-- =============================================================================
-- imobi — fluxo do proprietário e aprovação pelo Master (M2).
--
-- Decisão de produto (2026-10-08): o proprietário que acabou de se candidatar
-- já pode cadastrar e enviar o imóvel. Nada vai ao ar até o Master aprovar o
-- proprietário E o imóvel — e quem segura isso é o banco (trigger abaixo), não
-- a tela do Master.
--
-- Mídia: cada foto ou vídeo é guardado duas vezes. A cópia LIMPA (sem EXIF/GPS)
-- vai para o bucket público e é a única que o site serve. O ORIGINAL, com a
-- localização de onde foi capturado, vai para o bucket privado e serve ao Master
-- como prova antifraude: a foto foi tirada no endereço declarado?
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Quem chama já se candidatou a proprietário e não foi bloqueado.
create or replace function private.is_owner_applicant() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.owner_profiles
    where user_id = auth.uid() and status in ('pendente', 'aprovado')
  )
$$;

-- O dono deste imóvel foi aprovado pelo Master? Recebe o id do IMÓVEL, não de
-- usuário: responde sobre o imóvel, igual para qualquer um que pergunte.
create or replace function private.property_owner_approved(_p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.property_private pp
    join public.owner_profiles op on op.user_id = pp.owner_id
    where pp.property_id = _p and op.status = 'aprovado'
  )
$$;

grant execute on function private.is_owner_applicant() to authenticated;

-- ---------------------------------------------------------------------------
-- Candidatura do proprietário
--
-- Uma chamada só: nome, contato e o pedido. Nunca recebe status — o pedido
-- nasce 'pendente' e só uma RPC do Master muda isso.
-- ---------------------------------------------------------------------------
create or replace function public.apply_as_owner(
  _full_name text, _phone text, _whatsapp text default '', _cpf_cnpj text default '')
returns public.owner_status language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_status public.owner_status;
  v_phone text := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  v_whats text := regexp_replace(coalesce(_whatsapp, ''), '\D', '', 'g');
  v_doc text := regexp_replace(coalesce(_cpf_cnpj, ''), '\D', '', 'g');
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.caller_active() then
    raise exception 'user_blocked' using errcode = '42501';
  end if;

  select status into v_status from public.owner_profiles where user_id = v_uid;
  if v_status = 'bloqueado' then
    raise exception 'owner_blocked' using errcode = '42501';
  end if;

  if length(trim(coalesce(_full_name, ''))) < 3 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if length(v_phone) not between 10 and 13 then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if v_whats <> '' and length(v_whats) not between 10 and 13 then
    raise exception 'invalid_whatsapp' using errcode = '22023';
  end if;
  if v_doc <> '' and length(v_doc) not in (11, 14) then
    raise exception 'invalid_cpf_cnpj' using errcode = '22023';
  end if;

  update public.profiles set full_name = trim(_full_name) where id = v_uid;

  insert into public.contacts (user_id, phone, whatsapp, cpf_cnpj)
  values (v_uid, v_phone, nullif(v_whats, ''), nullif(v_doc, ''))
  on conflict (user_id) do update
    set phone = excluded.phone,
        whatsapp = coalesce(excluded.whatsapp, public.contacts.whatsapp),
        cpf_cnpj = coalesce(excluded.cpf_cnpj, public.contacts.cpf_cnpj);

  if v_status is null then
    insert into public.owner_profiles (user_id) values (v_uid);
    v_status := 'pendente';
    perform private.log_audit('owner.applied', 'owner', v_uid::text, '{}');
  end if;

  return v_status;
end $$;

-- ---------------------------------------------------------------------------
-- Cadastro do imóvel: candidato já pode criar rascunho
-- ---------------------------------------------------------------------------
create or replace function public.create_property(
  _type public.property_type,
  _purpose public.property_purpose,
  _title text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not private.is_owner_applicant() then
    raise exception 'not_an_owner' using errcode = '42501';
  end if;
  if not private.caller_active() then
    raise exception 'user_blocked' using errcode = '42501';
  end if;

  insert into public.properties (type, purpose, title, status)
  values (_type, _purpose, coalesce(_title, ''), 'rascunho')
  returning id into v_id;

  insert into public.property_private (property_id, owner_id)
  values (v_id, auth.uid());

  perform private.log_audit('property.created', 'property', v_id::text, '{}');
  return v_id;
end $$;

-- O dono envia para a fila do Master. Recusa anúncio incompleto e diz o que
-- falta, para a tela mostrar sem adivinhar.
create or replace function public.submit_property(_property uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  p public.properties%rowtype;
  pp public.property_private%rowtype;
  missing text[] := '{}';
begin
  if not private.owns_property(_property) or not private.caller_active() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into p from public.properties where id = _property;
  select * into pp from public.property_private where property_id = _property;

  if p.status not in ('rascunho', 'rejeitado', 'pausado', 'aguardando_aprovacao') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  if trim(p.title) = '' then missing := array_append(missing, 'titulo'); end if;
  if trim(p.city) = '' or trim(p.state) = '' then missing := array_append(missing, 'cidade'); end if;
  if trim(p.neighborhood) = '' then missing := array_append(missing, 'bairro'); end if;
  if p.purpose in ('venda', 'venda_locacao') and pp.price_sale is null then
    missing := array_append(missing, 'preco_venda');
  end if;
  if p.purpose in ('locacao', 'venda_locacao') and pp.price_rent is null then
    missing := array_append(missing, 'preco_aluguel');
  end if;
  if not exists (select 1 from public.property_media m
                  where m.property_id = _property and m.kind = 'foto') then
    missing := array_append(missing, 'fotos');
  end if;

  if cardinality(missing) > 0 then
    raise exception 'incomplete:%', array_to_string(missing, ',') using errcode = '22023';
  end if;

  update public.properties
     set status = 'aguardando_aprovacao', rejection_reason = null
   where id = _property;

  perform private.log_audit('property.submitted', 'property', _property::text, '{}');
end $$;

-- ---------------------------------------------------------------------------
-- Nada vai ao ar sem o proprietário aprovado
--
-- Trigger, e não um `if` dentro de set_property_status: vale para qualquer
-- caminho que mude o status, inclusive um que ainda não existe.
-- ---------------------------------------------------------------------------
create or replace function private.tg_property_requires_approved_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status
     and (new.status = 'aprovado' or private.property_is_public(new.status))
     and not private.property_owner_approved(new.id) then
    raise exception 'owner_not_approved' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger properties_requires_approved_owner
  before update of status on public.properties
  for each row execute function private.tg_property_requires_approved_owner();

-- ---------------------------------------------------------------------------
-- Foto nova em anúncio publicado volta para aprovação
--
-- Mesma regra do texto (0002): uma foto pode trazer uma placa com telefone tão
-- bem quanto a descrição. O Master adiciona sem derrubar a publicação.
-- ---------------------------------------------------------------------------
create or replace function private.tg_media_reapprove() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.is_master() then
    return new;
  end if;
  update public.properties
     set status = 'aguardando_aprovacao', published_at = null
   where id = new.property_id and private.property_is_public(status);
  if found then
    insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
    values (auth.uid(), 'property.reapproval_required', 'property', new.property_id::text,
            jsonb_build_object('reason', 'media'));
  end if;
  return new;
end $$;

create trigger property_media_reapprove
  after insert or update of storage_path on public.property_media
  for each row execute function private.tg_media_reapprove();

-- ---------------------------------------------------------------------------
-- Originais da mídia (com GPS) — só dono e Master
-- ---------------------------------------------------------------------------
alter table public.property_media
  add constraint property_media_id_property_key unique (id, property_id);

create table public.property_media_originals (
  media_id uuid primary key,
  property_id uuid not null references public.properties (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  -- O original pertence à mesma mídia E ao mesmo imóvel.
  foreign key (media_id, property_id)
    references public.property_media (id, property_id) on delete cascade,
  constraint property_media_originals_path
    check (storage_path like property_id::text || '/originais/%')
);
create index on public.property_media_originals (property_id);

alter table public.property_media_originals enable row level security;

create policy property_media_originals_rw on public.property_media_originals
  for all to authenticated
  using ((select private.owns_property(property_id)) or (select private.is_master()))
  with check ((select private.owns_property(property_id)) or (select private.is_master()));

revoke all on public.property_media_originals from anon, authenticated;
grant select, insert, delete on public.property_media_originals to authenticated;

-- ---------------------------------------------------------------------------
-- Painel do Master: proprietários com contato e e-mail
--
-- Único caminho até o e-mail (auth.users). Só o Master.
-- ---------------------------------------------------------------------------
create or replace function public.master_owners(
  _status public.owner_status default null, _user uuid default null)
returns table (
  user_id uuid, full_name text, email text, phone text, whatsapp text,
  cpf_cnpj text, status public.owner_status, user_status public.user_status,
  applied_at timestamptz, decided_at timestamptz, properties_count bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not private.is_master() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select op.user_id, coalesce(pr.full_name, ''), u.email::text, c.phone, c.whatsapp,
         c.cpf_cnpj, op.status, pr.status, op.created_at, op.decided_at,
         (select count(*) from public.property_private pp where pp.owner_id = op.user_id)
    from public.owner_profiles op
    join auth.users u on u.id = op.user_id
    left join public.profiles pr on pr.id = op.user_id
    left join public.contacts c on c.user_id = op.user_id
   where (_status is null or op.status = _status)
     and (_user is null or op.user_id = _user)
   order by op.created_at desc;
end $$;

-- ---------------------------------------------------------------------------
-- Buckets: originais de vídeo e foto de celular
-- ---------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png',
                                  'image/webp', 'video/mp4', 'video/quicktime']
 where id = 'property-docs';

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp',
                                  'video/mp4', 'video/quicktime']
 where id = 'property-media';

-- ---------------------------------------------------------------------------
-- GRANTs (a 0004 tirou o EXECUTE padrão; cada função é liberada aqui)
-- ---------------------------------------------------------------------------
grant execute on function
  public.apply_as_owner(text, text, text, text),
  public.master_owners(public.owner_status, uuid)
to authenticated;
