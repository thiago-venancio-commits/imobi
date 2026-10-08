-- =============================================================================
-- imobi — isolamento do Storage (fotos e documentos dos imóveis).
--
-- Trap #13 do kit: um bucket em que qualquer usuário autenticado lê e grava
-- qualquer objeto. Os caminhos são UUIDs, então nada aparece por acidente, e
-- por isso o bug sobrevive a todo teste manual.
--
-- Convenção de caminho: {property_id}/{arquivo}. A primeira pasta decide quem
-- pode gravar: o dono do imóvel (ativo) e o Master.
-- =============================================================================
do $$
declare
  v_master uuid := gen_random_uuid();
  v_owner  uuid := gen_random_uuid();
  v_owner2 uuid := gen_random_uuid();
  v_buyer  uuid := gen_random_uuid();
  p1 uuid; p2 uuid; n int; checks int := 0;
  docs_public boolean; media_public boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_master,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','m5@test.invalid',now(),'{}','{}'),
    (v_owner, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','o5@test.invalid',now(),'{}','{}'),
    (v_owner2,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','o6@test.invalid',now(),'{}','{}'),
    (v_buyer, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','b5@test.invalid',now(),'{}','{}');
  insert into public.platform_admins (user_id) values (v_master);
  insert into public.owner_profiles (user_id, status) values (v_owner,'aprovado'), (v_owner2,'aprovado');

  -- 0. Buckets: documentos NUNCA públicos --------------------------------------
  select public into docs_public  from storage.buckets where id = 'property-docs';
  select public into media_public from storage.buckets where id = 'property-media';
  if docs_public is null or media_public is null then
    raise exception 'ISOLATION_FAIL: buckets property-media/property-docs não existem';
  end if;
  if docs_public then raise exception 'ISOLATION_FAIL: bucket de documentos é público'; end if;
  if not media_public then raise exception 'ISOLATION_FAIL: bucket de fotos não é público (a vitrine não carregaria)'; end if;
  checks := checks + 3;

  -- O Supabase real recusa DELETE direto em storage.objects, a menos que a
  -- sessão ligue esta flag — que é o que a própria Storage API faz antes de
  -- apagar. As policies de RLS continuam valendo por cima dela, e são elas que
  -- este teste confere.
  perform set_config('storage.allow_delete_query', 'true', true);

  -- Cada dono com um imóvel.
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner,'role','authenticated')::text, true);
  set local role authenticated;
  p1 := public.create_property('casa','venda','Casa do dono 1');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner2,'role','authenticated')::text, true);
  set local role authenticated;
  p2 := public.create_property('casa','venda','Casa do dono 2');

  -- 1. Dono 2 grava na própria pasta -----------------------------------------
  insert into storage.objects (bucket_id, name) values ('property-media', p2::text || '/capa.jpg');
  insert into storage.objects (bucket_id, name) values ('property-docs',  p2::text || '/escritura.pdf');
  checks := checks + 1;

  -- 2. …mas não na pasta do dono 1 -------------------------------------------
  begin
    insert into storage.objects (bucket_id, name) values ('property-media', p1::text || '/invasao.jpg');
    raise exception 'ISOLATION_FAIL: dono gravou foto na pasta de imóvel alheio';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('property-docs', p1::text || '/invasao.pdf');
    raise exception 'ISOLATION_FAIL: dono gravou documento na pasta de imóvel alheio';
  exception when insufficient_privilege then null;
  end;
  -- Nem fora da convenção de caminho.
  begin
    insert into storage.objects (bucket_id, name) values ('property-media', 'solto.jpg');
    raise exception 'ISOLATION_FAIL: upload aceito fora de uma pasta de imóvel';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('property-media', 'nao-e-uuid/x.jpg');
    raise exception 'ISOLATION_FAIL: upload aceito com pasta que não é id de imóvel';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 4;

  -- 3. Dono 1 grava o dele; dono 2 não apaga nem lista o dele -----------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner,'role','authenticated')::text, true);
  set local role authenticated;
  insert into storage.objects (bucket_id, name) values ('property-media', p1::text || '/sala.jpg');
  insert into storage.objects (bucket_id, name) values ('property-docs',  p1::text || '/iptu.pdf');

  select count(*) into n from storage.objects where bucket_id = 'property-docs';
  if n <> 1 then raise exception 'ISOLATION_FAIL: dono lista % documentos, esperado só o próprio', n; end if;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner2,'role','authenticated')::text, true);
  set local role authenticated;
  delete from storage.objects where name like p1::text || '/%';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ISOLATION_FAIL: dono apagou % arquivo(s) de imóvel alheio', n; end if;
  update storage.objects set name = p2::text || '/roubada.jpg' where name = p1::text || '/sala.jpg';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ISOLATION_FAIL: dono moveu arquivo de imóvel alheio'; end if;
  checks := checks + 3;

  -- 4. Comprador: não grava e não lista nada ---------------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_buyer,'role','authenticated')::text, true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name) values ('property-media', p1::text || '/comprador.jpg');
    raise exception 'ISOLATION_FAIL: comprador gravou no bucket de fotos';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from storage.objects where bucket_id = 'property-docs';
  if n <> 0 then raise exception 'ISOLATION_FAIL: comprador listou % documento(s)', n; end if;
  -- Listar as fotos permitiria achar imagens de imóveis ainda não aprovados.
  select count(*) into n from storage.objects;
  if n <> 0 then raise exception 'ISOLATION_FAIL: comprador listou % objeto(s) do storage', n; end if;
  checks := checks + 3;

  -- 5. anon: nada ------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  select count(*) into n from storage.objects;
  if n <> 0 then raise exception 'ISOLATION_FAIL: anon listou % objeto(s) do storage', n; end if;
  begin
    insert into storage.objects (bucket_id, name) values ('property-media', p1::text || '/anon.jpg');
    raise exception 'ISOLATION_FAIL: anon gravou no storage';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 2;

  -- 6. Master gerencia qualquer imóvel ----------------------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_master,'role','authenticated')::text, true);
  set local role authenticated;
  insert into storage.objects (bucket_id, name) values ('property-media', p1::text || '/do-master.jpg');
  select count(*) into n from storage.objects
   where bucket_id = 'property-docs' and private.storage_property_id(name) in (p1, p2);
  if n <> 2 then raise exception 'ISOLATION_FAIL: Master lê % documentos, esperado 2', n; end if;
  delete from storage.objects where name = p1::text || '/do-master.jpg';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ISOLATION_FAIL: Master não apagou arquivo'; end if;
  checks := checks + 3;

  -- 7. Dono bloqueado perde o upload na hora ----------------------------------
  reset role;
  update public.profiles set status = 'bloqueado' where id = v_owner;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner,'role','authenticated')::text, true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name) values ('property-media', p1::text || '/bloqueado.jpg');
    raise exception 'ISOLATION_FAIL: dono bloqueado ainda faz upload';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 1;

  -- 8. property_media não aponta para arquivo de outro imóvel -----------------
  reset role;
  update public.profiles set status = 'ativo' where id = v_owner;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner,'role','authenticated')::text, true);
  set local role authenticated;
  insert into public.property_media (property_id, storage_path) values (p1, p1::text || '/sala.jpg');
  begin
    insert into public.property_media (property_id, storage_path) values (p1, p2::text || '/capa.jpg');
    raise exception 'ISOLATION_FAIL: anúncio exibe foto de outro imóvel';
  exception when check_violation then null;
  end;
  checks := checks + 2;

  raise exception 'ISOLATION_OK: % verificações passaram', checks;
end $$;
