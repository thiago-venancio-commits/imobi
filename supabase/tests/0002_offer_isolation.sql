-- =============================================================================
-- imobi — teste do banco de oferta.
--
-- Prova central: o comprador e o anônimo enxergam o imóvel inteiro do lado
-- público e ZERO linhas do lado privado. Preço, endereço e dono não vazam nem
-- por SELECT direto no PostgREST.
-- =============================================================================
do $$
declare
  v_master uuid := gen_random_uuid();
  v_broker uuid := gen_random_uuid();
  v_buyer  uuid := gen_random_uuid();
  v_owner  uuid := gen_random_uuid();
  v_owner2 uuid := gen_random_uuid();
  prop uuid; prop2 uuid; n int; checks int := 0;
  st public.property_status; txt text;
  alat double precision; alng double precision;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_master, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','m2@test.invalid',now(),'{}','{}'),
    (v_broker, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','c2@test.invalid',now(),'{}','{}'),
    (v_buyer,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','b2@test.invalid',now(),'{}','{}'),
    (v_owner,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','o2@test.invalid',now(),'{}','{}'),
    (v_owner2, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','o3@test.invalid',now(),'{}','{}');

  insert into public.platform_admins (user_id) values (v_master);
  insert into public.brokers (user_id, status) values (v_broker, 'autorizado');
  insert into public.owner_profiles (user_id, status) values (v_owner, 'aprovado'), (v_owner2, 'aprovado');

  -- 1. Proprietário cadastra -------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);
  set local role authenticated;

  prop := public.create_property('casa', 'venda', 'Casa com 3 quartos');
  update public.properties
     set description = 'Ótima casa, quintal grande', city = 'Belo Horizonte',
         state = 'MG', neighborhood = 'Castelo',
         bedrooms = 3, suites = 1, parking_spaces = 2
   where id = prop;

  -- O imóvel nasce rascunho (só entra na fila quando o dono envia), com
  -- código gerado e dono vindo do token.
  select status into st from public.properties where id = prop;
  if st <> 'rascunho' then
    raise exception 'ISOLATION_FAIL: imóvel nasceu como %, esperado rascunho', st; end if;
  select count(*) into n from public.property_private pp
   where pp.property_id = prop and pp.owner_id = v_owner;
  if n <> 1 then raise exception 'ISOLATION_FAIL: create_property não vinculou o dono'; end if;
  select code into txt from public.properties where id = prop;
  if txt !~ '^IMB-[0-9]{5}$' then raise exception 'ISOLATION_FAIL: código inválido: %', txt; end if;
  checks := checks + 3;

  -- O dono preenche o lado comercial e o endereço exato.
  update public.property_private
     set price_sale = 650000, min_price = 600000,
         address = 'Rua das Flores', street_number = '100', cep = '30000-000',
         exact_lat = -19.9191, exact_lng = -43.9386
   where property_id = prop;

  -- Não pode mexer no próprio status nem na comissão.
  begin
    update public.properties set status = 'publicado' where id = prop;
    raise exception 'ISOLATION_FAIL: dono publicou o próprio imóvel';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.property_private set commission_pct = 0 where property_id = prop;
    raise exception 'ISOLATION_FAIL: dono alterou a comissão';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_property_status(prop, 'publicado');
    raise exception 'ISOLATION_FAIL: dono chamou set_property_status';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 3;

  -- A coordenada pública é deslocada da exata (§6).
  reset role;
  select approx_lat, approx_lng into alat, alng from public.properties where id = prop;
  if alat is null then raise exception 'ISOLATION_FAIL: coordenada aproximada não calculada'; end if;
  if alat = -19.9191 and alng = -43.9386 then
    raise exception 'ISOLATION_FAIL: coordenada pública é a exata'; end if;
  if abs(alat - (-19.9191)) > 0.01 or abs(alng - (-43.9386)) > 0.01 then
    raise exception 'ISOLATION_FAIL: deslocamento grande demais, o imóvel some do bairro'; end if;
  checks := checks + 3;

  -- 2. Master publica --------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_master, 'role','authenticated')::text, true);
  set local role authenticated;
  perform public.set_property_status(prop, 'publicado');
  select status into st from public.properties where id = prop;
  if st <> 'publicado' then raise exception 'ISOLATION_FAIL: Master não publicou'; end if;
  select count(*) into n from public.property_private where property_id = prop;
  if n <> 1 then raise exception 'ISOLATION_FAIL: Master não lê o lado privado'; end if;
  checks := checks + 2;

  -- Um segundo imóvel, de outro dono, fica sem publicar.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner2, 'role','authenticated')::text, true);
  set local role authenticated;
  prop2 := public.create_property('apartamento', 'venda', 'Apto não publicado');
  update public.properties set city = 'Belo Horizonte', state = 'MG',
         neighborhood = 'Savassi' where id = prop2;
  update public.property_private set price_sale = 420000 where property_id = prop2;

  -- 3. O COMPRADOR: vê o anúncio, não vê preço nem endereço ------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_buyer, 'role','authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.properties where id = prop;
  if n <> 1 then raise exception 'ISOLATION_FAIL: comprador não enxerga imóvel publicado'; end if;

  select count(*) into n from public.property_private;
  if n <> 0 then raise exception 'ISOLATION_FAIL: comprador leu % linhas de property_private', n; end if;
  select count(*) into n from public.property_private where property_id = prop;
  if n <> 0 then raise exception 'ISOLATION_FAIL: comprador leu o preço do imóvel publicado'; end if;

  -- O imóvel não publicado não aparece.
  select count(*) into n from public.properties where id = prop2;
  if n <> 0 then raise exception 'ISOLATION_FAIL: comprador enxerga imóvel não publicado'; end if;

  -- E não dá para descobrir o dono pela metade pública.
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'properties'
     and column_name in ('owner_id','price_sale','price_rent','min_price','address','cep','exact_lat','exact_lng');
  if n <> 0 then raise exception 'ISOLATION_FAIL: properties tem % coluna(s) que deveriam ser privadas', n; end if;

  -- Também não escreve nada.
  begin
    update public.properties set title = 'invadido' where id = prop;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'ISOLATION_FAIL: comprador editou o anúncio'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_property('casa', 'venda', 'Imóvel de comprador');
    raise exception 'ISOLATION_FAIL: comprador sem aprovação cadastrou imóvel';
  exception when insufficient_privilege then null;
  end;
  -- E não existe caminho de INSERT direto que contorne a RPC.
  begin
    insert into public.properties (type, purpose, title, city, state, neighborhood)
    values ('casa','venda','Direto','BH','MG','X');
    raise exception 'ISOLATION_FAIL: INSERT direto em properties foi aceito';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 8;

  -- 4. ANON: mesma coisa, sem sessão ----------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;

  select count(*) into n from public.properties where id = prop;
  if n <> 1 then raise exception 'ISOLATION_FAIL: anon não enxerga imóvel publicado'; end if;
  begin
    select count(*) into n from public.property_private;
    raise exception 'ISOLATION_FAIL: anon leu property_private (% linhas)', n;
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from public.property_documents;
    raise exception 'ISOLATION_FAIL: anon leu documentos (% linhas)', n;
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_property_status(prop, 'publicado');
    raise exception 'ISOLATION_FAIL: anon chamou set_property_status';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 4;

  -- 5. Outro proprietário não enxerga o imóvel alheio por dentro ------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner2, 'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.property_private where property_id = prop;
  if n <> 0 then raise exception 'ISOLATION_FAIL: proprietário lê o preço de imóvel alheio'; end if;
  update public.property_private set price_sale = 1 where property_id = prop;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ISOLATION_FAIL: proprietário alterou preço alheio'; end if;
  checks := checks + 2;

  -- 6. Corretor autorizado enxerga o anúncio, mas não o preço nesta fase ----
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_broker, 'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.properties where id = prop2;
  if n <> 1 then raise exception 'ISOLATION_FAIL: corretor não enxerga imóvel não publicado'; end if;
  select count(*) into n from public.property_private where property_id = prop;
  if n <> 0 then raise exception 'ISOLATION_FAIL: corretor lê preço sem lead vinculado'; end if;
  checks := checks + 2;

  -- 7. Editar anúncio publicado devolve para aprovação (§7) -----------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);
  set local role authenticated;
  update public.properties set description = 'Nova descrição' where id = prop;
  select status into st from public.properties where id = prop;
  if st <> 'aguardando_aprovacao' then
    raise exception 'ISOLATION_FAIL: edição de publicado manteve status %', st; end if;
  select published_at into alat from public.properties where id = prop;
  if alat is not null then raise exception 'ISOLATION_FAIL: published_at sobreviveu à reaprovação'; end if;
  checks := checks + 2;

  -- Mexer só no preço não derruba a publicação: preço não é conteúdo público.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_master, 'role','authenticated')::text, true);
  set local role authenticated;
  perform public.set_property_status(prop, 'publicado');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);
  set local role authenticated;
  update public.property_private set price_sale = 640000 where property_id = prop;
  select status into st from public.properties where id = prop;
  if st <> 'publicado' then
    raise exception 'ISOLATION_FAIL: mudar preço derrubou a publicação (status %)', st; end if;
  checks := checks + 1;

  -- 8. Máscara anti-contato no anúncio (§34) --------------------------------
  update public.properties
     set description = 'Casa ótima, chama no 31 99999-8888 ou dono@gmail.com'
   where id = prop;
  select description into txt from public.properties where id = prop;
  if txt ~ '9999' or txt ~ '@gmail' then
    raise exception 'ISOLATION_FAIL: anúncio publicou contato do dono: %', txt; end if;
  checks := checks + 1;

  -- 9. Master define a precisão da localização (§6) -------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_master, 'role','authenticated')::text, true);
  set local role authenticated;
  perform public.set_property_location_precision(prop, 'bairro');
  reset role;
  select approx_lat into alat from public.properties where id = prop;
  if alat is not null then
    raise exception 'ISOLATION_FAIL: precisão "bairro" ainda publica coordenada'; end if;
  checks := checks + 1;

  raise exception 'ISOLATION_OK: % verificações passaram', checks;
end $$;
