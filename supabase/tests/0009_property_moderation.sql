-- =============================================================================
-- imobi — moderação: anúncio bloqueado sai do ar e só o Master desbloqueia;
-- excluir é só do Master e deixa rastro.
-- =============================================================================
do $$
declare
  v_master uuid := gen_random_uuid();
  v_owner  uuid := gen_random_uuid();
  v_buyer  uuid := gen_random_uuid();
  p1 uuid; n int; checks int := 0; st public.property_status;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_master,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','m9@test.invalid',now(),'{}','{}'),
    (v_owner, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','o10@test.invalid',now(),'{}','{}'),
    (v_buyer, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','b9@test.invalid',now(),'{}','{}');
  insert into public.platform_admins (user_id) values (v_master);
  insert into public.owner_profiles (user_id, status) values (v_owner, 'aprovado');

  -- Imóvel completo e publicado.
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner,'role','authenticated')::text, true);
  set local role authenticated;
  p1 := public.create_property('casa', 'venda', 'Casa a moderar');
  update public.properties set city = 'BH', state = 'MG', neighborhood = 'Centro' where id = p1;
  update public.property_private set price_sale = 500000 where property_id = p1;
  insert into public.property_media (property_id, storage_path, is_cover) values (p1, p1::text || '/capa.jpg', true);
  insert into public.property_documents (property_id, storage_path, label) values (p1, p1::text || '/documentos/iptu.pdf', 'IPTU');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_master,'role','authenticated')::text, true);
  set local role authenticated;
  perform public.set_property_status(p1, 'publicado');

  -- 1. Master bloqueia: sai da vitrine ----------------------------------------
  perform public.set_property_status(p1, 'pausado');
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  select count(*) into n from public.properties where id = p1;
  if n <> 0 then raise exception 'ISOLATION_FAIL: anúncio bloqueado continua na vitrine'; end if;
  select count(*) into n from public.property_media where property_id = p1;
  if n <> 0 then raise exception 'ISOLATION_FAIL: fotos de anúncio bloqueado continuam públicas'; end if;
  checks := checks + 2;

  -- 2. O dono não tira o bloqueio, nem reenviando ----------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner,'role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.submit_property(p1);
    raise exception 'ISOLATION_FAIL: dono reenviou anúncio bloqueado pelo Master';
  exception when insufficient_privilege then null;
  end;
  select status into st from public.properties where id = p1;
  if st <> 'pausado' then raise exception 'ISOLATION_FAIL: bloqueio caiu (status %)', st; end if;
  -- Editar o texto do anúncio bloqueado não o devolve ao ar.
  update public.properties set description = 'nova descrição' where id = p1;
  select status into st from public.properties where id = p1;
  if st <> 'pausado' then raise exception 'ISOLATION_FAIL: edição tirou o bloqueio (status %)', st; end if;
  checks := checks + 2;

  -- 3. Ninguém além do Master exclui -----------------------------------------
  begin
    perform public.delete_property(p1);
    raise exception 'ISOLATION_FAIL: dono excluiu o anúncio pela RPC do Master';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.properties where id = p1;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'ISOLATION_FAIL: dono excluiu o anúncio por DELETE direto'; end if;
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_buyer,'role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.delete_property(p1);
    raise exception 'ISOLATION_FAIL: comprador excluiu o anúncio';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 3;

  -- 4. Master desbloqueia e depois exclui, com rastro -------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_master,'role','authenticated')::text, true);
  set local role authenticated;
  perform public.set_property_status(p1, 'publicado');
  select status into st from public.properties where id = p1;
  if st <> 'publicado' then raise exception 'ISOLATION_FAIL: Master não desbloqueou'; end if;

  perform public.delete_property(p1);
  reset role;
  select count(*) into n from public.properties where id = p1;
  if n <> 0 then raise exception 'ISOLATION_FAIL: imóvel não foi excluído'; end if;
  select count(*) into n from public.property_private where property_id = p1;
  if n <> 0 then raise exception 'ISOLATION_FAIL: metade privada sobrou após excluir'; end if;
  select count(*) into n from public.property_media where property_id = p1;
  if n <> 0 then raise exception 'ISOLATION_FAIL: mídias sobraram após excluir'; end if;
  select count(*) into n from public.property_documents where property_id = p1;
  if n <> 0 then raise exception 'ISOLATION_FAIL: documentos sobraram após excluir'; end if;
  select count(*) into n from public.audit_log
   where action = 'property.deleted' and target_id = p1::text and actor_id = v_master
     and metadata->>'title' = 'Casa a moderar';
  if n <> 1 then raise exception 'ISOLATION_FAIL: exclusão sem registro na auditoria'; end if;
  checks := checks + 6;

  raise exception 'ISOLATION_OK: % verificações passaram', checks;
end $$;
