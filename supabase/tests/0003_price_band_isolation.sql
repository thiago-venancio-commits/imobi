-- =============================================================================
-- imobi — teste da faixa de preço pública.
--
-- A faixa é um vazamento consciente e limitado (ver cabeçalho de
-- 0003_price_bands.sql). Este teste existe para garantir que ele continue
-- limitado: o comprador aprende a faixa, nunca o valor.
-- =============================================================================
do $$
declare
  v_master uuid := gen_random_uuid();
  v_owner  uuid := gen_random_uuid();
  v_buyer  uuid := gen_random_uuid();
  p1 uuid; p2 uuid; p3 uuid; n int; checks int := 0;
  b1 public.sale_band; b2 public.sale_band; rb public.rent_band;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_master,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','m3@test.invalid',now(),'{}','{}'),
    (v_owner, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','o4@test.invalid',now(),'{}','{}'),
    (v_buyer, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','b3@test.invalid',now(),'{}','{}');
  insert into public.platform_admins (user_id) values (v_master);
  insert into public.owner_profiles (user_id, status) values (v_owner, 'aprovado');

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner,'role','authenticated')::text, true);
  set local role authenticated;
  p1 := public.create_property('casa','venda','Casa A');
  p2 := public.create_property('casa','venda','Casa B');
  p3 := public.create_property('apartamento','locacao','Apto C');
  update public.property_private set price_sale = 610000 where property_id = p1;
  update public.property_private set price_sale = 990000 where property_id = p2;
  update public.property_private set price_rent = 3500   where property_id = p3;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_master,'role','authenticated')::text, true);
  set local role authenticated;
  perform public.set_property_status(p1, 'publicado');
  perform public.set_property_status(p2, 'publicado');
  perform public.set_property_status(p3, 'publicado');

  -- 1. A faixa é derivada sozinha, sem ninguém escrever --------------------
  reset role;
  select sale_band into b1 from public.properties where id = p1;
  select sale_band into b2 from public.properties where id = p2;
  select rent_band into rb from public.properties where id = p3;
  if b1 is null then raise exception 'ISOLATION_FAIL: faixa não calculada'; end if;
  if rb <> 'de_2k_5k' then raise exception 'ISOLATION_FAIL: faixa de aluguel errada: %', rb; end if;
  checks := checks + 2;

  -- 2. A faixa é GROSSA: 610 mil e 990 mil caem na mesma -------------------
  -- Esta é a checagem que impede o oráculo de virar o preço. Se um dia
  -- alguém estreitar as faixas, é aqui que o teste fica vermelho.
  if b1 <> b2 then
    raise exception 'ISOLATION_FAIL: faixas estreitas demais — 610k caiu em % e 990k em %', b1, b2;
  end if;
  if b1 <> 'de_600k_1mi' then raise exception 'ISOLATION_FAIL: faixa inesperada %', b1; end if;
  select count(distinct sale_band) into n from public.properties where sale_band is not null;
  if n <> 1 then raise exception 'ISOLATION_FAIL: % faixas distintas para preços da mesma faixa', n; end if;
  checks := checks + 3;

  -- 3. O comprador lê a faixa, nunca o valor -------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_buyer,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.properties where sale_band = 'de_600k_1mi';
  if n <> 2 then raise exception 'ISOLATION_FAIL: comprador não consegue filtrar por faixa'; end if;
  select count(*) into n from public.property_private;
  if n <> 0 then raise exception 'ISOLATION_FAIL: comprador leu o preço exato'; end if;
  checks := checks + 2;

  -- 4. Ninguém escreve a faixa à mão ---------------------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner,'role','authenticated')::text, true);
  set local role authenticated;
  begin
    update public.properties set sale_band = 'ate_300k' where id = p1;
    raise exception 'ISOLATION_FAIL: dono escreveu a faixa à mão';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 1;

  -- 5. Mudar o preço reajusta a faixa sozinho ------------------------------
  update public.property_private set price_sale = 250000 where property_id = p1;
  reset role;
  select sale_band into b1 from public.properties where id = p1;
  if b1 <> 'ate_300k' then
    raise exception 'ISOLATION_FAIL: faixa não acompanhou o preço (%), ficaria fora de sincronia', b1;
  end if;
  checks := checks + 1;

  -- 6. anon também filtra por faixa, e segue sem ver preço -----------------
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  select count(*) into n from public.properties where sale_band is not null;
  if n < 1 then raise exception 'ISOLATION_FAIL: anon não enxerga faixa'; end if;
  begin
    select count(*) into n from public.property_private;
    raise exception 'ISOLATION_FAIL: anon leu preço exato';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 2;

  raise exception 'ISOLATION_OK: % verificações passaram', checks;
end $$;
