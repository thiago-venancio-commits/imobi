-- =============================================================================
-- imobi — fluxo do proprietário e aprovação do Master.
--
-- Prova central: o candidato a proprietário cadastra e envia o imóvel, mas
-- nada vai ao ar enquanto o Master não aprovar o proprietário E o imóvel. O
-- original da mídia (com GPS) nunca chega a quem não é dono nem Master.
-- =============================================================================
do $$
declare
  v_master uuid := gen_random_uuid();
  v_owner  uuid := gen_random_uuid();
  v_owner2 uuid := gen_random_uuid();
  v_buyer  uuid := gen_random_uuid();
  v_blocked uuid := gen_random_uuid();
  p1 uuid; p2 uuid; m1 uuid; n int; checks int := 0;
  st public.property_status; os public.owner_status; txt text;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_master, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','m6@test.invalid',now(),'{}','{}'),
    (v_owner,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','o7@test.invalid',now(),'{}','{}'),
    (v_owner2, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','o8@test.invalid',now(),'{}','{}'),
    (v_buyer,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','b6@test.invalid',now(),'{}','{}'),
    (v_blocked,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','x6@test.invalid',now(),'{}','{}');
  insert into public.platform_admins (user_id) values (v_master);
  insert into public.owner_profiles (user_id, status) values (v_owner2, 'aprovado'), (v_blocked, 'bloqueado');

  -- 1. Candidatura: nasce pendente, e não há como se aprovar ------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);
  set local role authenticated;
  os := public.apply_as_owner('Maria Proprietária', '(31) 98888-7777', '', '');
  if os <> 'pendente' then raise exception 'ISOLATION_FAIL: candidatura nasceu como %', os; end if;
  -- Chamar de novo não muda nada.
  os := public.apply_as_owner('Maria Proprietária', '31988887777', '31988887777', '');
  select status into os from public.owner_profiles where user_id = v_owner;
  if os <> 'pendente' then raise exception 'ISOLATION_FAIL: segunda candidatura mudou o status para %', os; end if;
  select phone into txt from public.contacts where user_id = v_owner;
  if txt <> '31988887777' then raise exception 'ISOLATION_FAIL: telefone não gravado (%)', txt; end if;
  begin
    perform public.set_owner_status(v_owner, 'aprovado');
    raise exception 'ISOLATION_FAIL: candidato se aprovou pela RPC do Master';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.owner_profiles set status = 'aprovado' where user_id = v_owner;
    raise exception 'ISOLATION_FAIL: candidato se aprovou por UPDATE direto';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 5;

  -- Proprietário bloqueado não se candidata de novo.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_blocked, 'role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.apply_as_owner('Fulano Bloqueado', '31977776666');
    raise exception 'ISOLATION_FAIL: proprietário bloqueado se candidatou de novo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_property('casa', 'venda', 'Bloqueado');
    raise exception 'ISOLATION_FAIL: proprietário bloqueado cadastrou imóvel';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 2;

  -- 2. O candidato já cadastra; o imóvel nasce rascunho -----------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);
  set local role authenticated;
  p1 := public.create_property('casa', 'venda', 'Casa da Maria');
  select status into st from public.properties where id = p1;
  if st <> 'rascunho' then raise exception 'ISOLATION_FAIL: imóvel nasceu como %, esperado rascunho', st; end if;
  checks := checks + 1;

  -- 3. Envio incompleto é recusado e diz o que falta -------------------------
  begin
    perform public.submit_property(p1);
    raise exception 'ISOLATION_FAIL: imóvel incompleto foi enviado';
  exception when invalid_parameter_value then
    get stacked diagnostics txt = message_text;
    if txt not like 'incomplete:%fotos%' or txt not like '%preco_venda%' then
      raise exception 'ISOLATION_FAIL: erro de envio não lista o que falta: %', txt;
    end if;
  end;
  checks := checks + 1;

  -- Completa tudo, menos a foto: ainda recusa.
  update public.properties set city = 'Belo Horizonte', state = 'MG', neighborhood = 'Castelo'
   where id = p1;
  update public.property_private set price_sale = 700000, address = 'Rua Secreta', street_number = '42'
   where property_id = p1;
  begin
    perform public.submit_property(p1);
    raise exception 'ISOLATION_FAIL: imóvel sem foto foi enviado';
  exception when invalid_parameter_value then null;
  end;
  checks := checks + 1;

  -- Foto limpa no público, original com GPS no privado.
  insert into public.property_media (property_id, storage_path, is_cover)
  values (p1, p1::text || '/capa.jpg', true) returning id into m1;
  insert into public.property_media_originals (media_id, property_id, storage_path)
  values (m1, p1, p1::text || '/originais/capa.jpg');
  -- O original não aponta para fora da pasta de originais.
  begin
    insert into public.property_media (property_id, storage_path) values (p1, p1::text || '/b.jpg')
      returning id into m1;
    insert into public.property_media_originals (media_id, property_id, storage_path)
    values (m1, p1, p1::text || '/b.jpg');
    raise exception 'ISOLATION_FAIL: original gravado fora de /originais/';
  exception when check_violation then null;
  end;
  checks := checks + 1;

  perform public.submit_property(p1);
  select status into st from public.properties where id = p1;
  if st <> 'aguardando_aprovacao' then raise exception 'ISOLATION_FAIL: envio não foi para a fila (%)', st; end if;
  checks := checks + 1;

  -- 4. Rascunho e fila não aparecem para ninguém de fora ----------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_buyer, 'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.properties where id = p1;
  if n <> 0 then raise exception 'ISOLATION_FAIL: comprador vê imóvel na fila de aprovação'; end if;
  select count(*) into n from public.property_media where property_id = p1;
  if n <> 0 then raise exception 'ISOLATION_FAIL: comprador vê fotos de imóvel não aprovado'; end if;
  select count(*) into n from public.property_media_originals;
  if n <> 0 then raise exception 'ISOLATION_FAIL: comprador lê originais com GPS'; end if;
  begin
    perform * from public.master_owners();
    raise exception 'ISOLATION_FAIL: comprador listou proprietários com e-mail e telefone';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 4;

  -- Outro proprietário também não.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner2, 'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.property_media_originals where property_id = p1;
  if n <> 0 then raise exception 'ISOLATION_FAIL: proprietário lê originais de imóvel alheio'; end if;
  begin
    perform * from public.master_owners();
    raise exception 'ISOLATION_FAIL: proprietário listou outros proprietários';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 2;

  -- 5. Master vê a fila, mas não publica com o proprietário pendente ----------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_master, 'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.master_owners('pendente') where user_id = v_owner and email = 'o7@test.invalid' and phone = '31988887777';
  if n <> 1 then raise exception 'ISOLATION_FAIL: Master não vê o candidato com e-mail e telefone'; end if;
  select count(*) into n from public.property_media_originals where property_id = p1;
  if n <> 1 then raise exception 'ISOLATION_FAIL: Master não lê o original para conferir o GPS'; end if;
  begin
    perform public.set_property_status(p1, 'publicado');
    raise exception 'ISOLATION_FAIL: imóvel publicado com proprietário pendente';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_property_status(p1, 'aprovado');
    raise exception 'ISOLATION_FAIL: imóvel aprovado com proprietário pendente';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 4;

  -- Aprova o proprietário, depois o imóvel.
  perform public.set_owner_status(v_owner, 'aprovado');
  perform public.set_property_status(p1, 'publicado');
  select status into st from public.properties where id = p1;
  if st <> 'publicado' then raise exception 'ISOLATION_FAIL: Master não publicou após aprovar o dono'; end if;
  checks := checks + 1;

  -- 6. Agora o público vê o anúncio e a foto limpa, nunca o original ---------
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  select count(*) into n from public.properties where id = p1;
  if n <> 1 then raise exception 'ISOLATION_FAIL: anon não vê imóvel publicado'; end if;
  select count(*) into n from public.property_media where property_id = p1;
  if n < 1 then raise exception 'ISOLATION_FAIL: anon não vê as fotos do publicado'; end if;
  begin
    select count(*) into n from public.property_media_originals;
    raise exception 'ISOLATION_FAIL: anon lê a tabela de originais';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 3;

  -- 7. Foto nova em anúncio publicado volta para aprovação --------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);
  set local role authenticated;
  insert into public.property_media (property_id, storage_path) values (p1, p1::text || '/nova.jpg');
  select status into st from public.properties where id = p1;
  if st <> 'aguardando_aprovacao' then
    raise exception 'ISOLATION_FAIL: foto nova foi ao ar sem aprovação (status %)', st;
  end if;
  checks := checks + 1;

  -- 8. Proprietário bloqueado depois: o Master não republica ------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_master, 'role','authenticated')::text, true);
  set local role authenticated;
  perform public.set_owner_status(v_owner, 'bloqueado');
  begin
    perform public.set_property_status(p1, 'publicado');
    raise exception 'ISOLATION_FAIL: imóvel de proprietário bloqueado foi publicado';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 1;

  -- 9. Proprietário aprovado também começa em rascunho ------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner2, 'role','authenticated')::text, true);
  set local role authenticated;
  p2 := public.create_property('apartamento', 'locacao', 'Apto');
  select status into st from public.properties where id = p2;
  if st <> 'rascunho' then raise exception 'ISOLATION_FAIL: imóvel de aprovado nasceu como %', st; end if;
  checks := checks + 1;

  raise exception 'ISOLATION_OK: % verificações passaram', checks;
end $$;
