-- =============================================================================
-- imobi — moderação de anúncios pelo Master: bloquear e excluir.
--
-- BLOQUEAR é o status 'pausado' (fora da vitrine, ver property_is_public). O
-- que faltava: o proprietário conseguia reenviar um anúncio bloqueado para a
-- fila (submit_property aceitava 'pausado'). Agora só o Master tira um anúncio
-- do bloqueio. É trigger, e não mudança em submit_property, para valer em
-- qualquer caminho que mude o status.
--
-- EXCLUIR é definitivo e só do Master. Apaga o imóvel e, em cascata, a metade
-- privada, mídias, originais e documentos. Os ARQUIVOS no Storage são apagados
-- antes, pela Server Action, via Storage API (o Supabase não deixa apagar
-- arquivo por SQL). Fica uma linha no audit_log com código e título.
-- =============================================================================

create or replace function private.tg_property_block_is_master_only() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'pausado' and new.status is distinct from old.status
     and not private.is_master() then
    raise exception 'blocked_by_master' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger properties_block_master_only
  before update of status on public.properties
  for each row execute function private.tg_property_block_is_master_only();

create or replace function public.delete_property(_property uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
  v_title text;
  v_owner uuid;
begin
  if not private.is_master() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select p.code, p.title, pp.owner_id into v_code, v_title, v_owner
    from public.properties p
    left join public.property_private pp on pp.property_id = p.id
   where p.id = _property;
  if not found then
    raise exception 'property_not_found' using errcode = 'P0002';
  end if;

  delete from public.properties where id = _property;

  perform private.log_audit('property.deleted', 'property', _property::text,
    jsonb_build_object('code', v_code, 'title', v_title, 'owner_id', v_owner));
end $$;

grant execute on function public.delete_property(uuid) to authenticated;
