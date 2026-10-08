-- =============================================================================
-- imobi — teste de isolamento do núcleo (papéis, contatos, máscara).
--
-- O bloco sempre termina em exceção, então tudo que ele cria é desfeito:
--   sucesso → mensagem começa com  ISOLATION_OK
--   falha   → mensagem começa com  ISOLATION_FAIL: <o que vazou>
--
-- Personas: master, corretor autorizado, corretor bloqueado, comprador,
-- proprietário.
-- =============================================================================
do $$
declare
  master_id   uuid := gen_random_uuid();
  broker_id   uuid := gen_random_uuid();
  broker2_id  uuid := gen_random_uuid();
  buyer_id    uuid := gen_random_uuid();
  owner_id    uuid := gen_random_uuid();
  n int; checks int := 0; txt text; b boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  values
    (master_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'master@test.invalid',  now(), '{}', '{"full_name":"Master"}'),
    (broker_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'corretor@test.invalid', now(), '{}', '{"full_name":"Corretor A"}'),
    (broker2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'corretor2@test.invalid',now(), '{}', '{"full_name":"Corretor B"}'),
    (buyer_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'comprador@test.invalid',now(), '{}', '{"full_name":"Comprador"}'),
    (owner_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dono@test.invalid',     now(), '{}', '{"full_name":"Proprietario"}');

  -- O trigger de signup criou um profile por usuário, e nada além disso.
  select count(*) into n from public.profiles where id in (master_id, broker_id, broker2_id, buyer_id, owner_id);
  if n <> 5 then raise exception 'ISOLATION_FAIL: signup criou % profiles, esperado 5', n; end if;
  select count(*) into n from public.platform_admins where user_id in (master_id, broker_id, broker2_id, buyer_id, owner_id);
  if n <> 0 then raise exception 'ISOLATION_FAIL: signup criou platform_admin'; end if;
  select count(*) into n from public.brokers where user_id in (master_id, broker_id, broker2_id, buyer_id, owner_id);
  if n <> 0 then raise exception 'ISOLATION_FAIL: signup criou broker'; end if;
  checks := checks + 3;

  -- Seed: o Master entra por fora do app, como em produção.
  insert into public.platform_admins (user_id) values (master_id);
  insert into public.brokers (user_id, status, creci) values (broker_id, 'autorizado', '12345');
  insert into public.brokers (user_id, status, creci) values (broker2_id, 'bloqueado', '67890');
  insert into public.owner_profiles (user_id, status) values (owner_id, 'aprovado');
  insert into public.contacts (user_id, phone, whatsapp, cpf_cnpj)
  values (buyer_id, '31999990000', '31999990000', '111.111.111-11'),
         (owner_id, '31988880000', '31988880000', '222.222.222-22');
  -- A auditoria precisa ter linha ANTES das checagens de leitura: contar zero
  -- numa tabela vazia não prova isolamento nenhum.
  insert into public.audit_log (actor_id, action, target_type, target_id)
  values (master_id, 'seed.test', 'test', 'seed');

  -- 1. Comprador: não enxerga contato de ninguém, nem do proprietário --------
  perform set_config('request.jwt.claims', json_build_object('sub', buyer_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.contacts where user_id = owner_id;
  if n <> 0 then raise exception 'ISOLATION_FAIL: comprador lê contato do proprietário'; end if;
  select count(*) into n from public.contacts;
  if n <> 1 then raise exception 'ISOLATION_FAIL: comprador lê % contatos, esperado só o próprio', n; end if;
  select count(*) into n from public.profiles where id = owner_id;
  if n <> 0 then raise exception 'ISOLATION_FAIL: comprador lê profile do proprietário'; end if;
  select count(*) into n from public.platform_admins;
  if n <> 0 then raise exception 'ISOLATION_FAIL: comprador descobre quem é Master'; end if;
  select count(*) into n from public.audit_log;
  if n <> 0 then raise exception 'ISOLATION_FAIL: comprador lê auditoria'; end if;
  checks := checks + 5;

  -- 2. Comprador não se promove ---------------------------------------------
  begin
    insert into public.platform_admins (user_id) values (buyer_id);
    raise exception 'ISOLATION_FAIL: comprador virou Master';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.brokers (user_id, status, creci) values (buyer_id, 'autorizado', 'x');
    raise exception 'ISOLATION_FAIL: comprador virou corretor autorizado';
  exception when insufficient_privilege or check_violation then null;
  end;
  begin
    insert into public.owner_profiles (user_id, status) values (buyer_id, 'aprovado');
    raise exception 'ISOLATION_FAIL: comprador virou proprietário aprovado';
  exception when insufficient_privilege or check_violation then null;
  end;
  if public.is_master() then raise exception 'ISOLATION_FAIL: is_master() true para comprador'; end if;
  if public.is_active_broker() then raise exception 'ISOLATION_FAIL: is_active_broker() true para comprador'; end if;
  checks := checks + 5;

  -- Candidatar-se é permitido, mas sempre como 'pendente'.
  insert into public.brokers (user_id, status, creci) values (buyer_id, 'pendente', '999');
  if public.is_active_broker() then raise exception 'ISOLATION_FAIL: candidato pendente já é corretor'; end if;
  begin
    update public.brokers set status = 'autorizado' where user_id = buyer_id;
    raise exception 'ISOLATION_FAIL: candidato se auto-aprovou';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_broker_status(buyer_id, 'autorizado');
    raise exception 'ISOLATION_FAIL: candidato chamou set_broker_status';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 3;

  -- 3. Proprietário: não enxerga contato nem perfil do comprador -------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.contacts where user_id = buyer_id;
  if n <> 0 then raise exception 'ISOLATION_FAIL: proprietário lê contato do comprador'; end if;
  select count(*) into n from public.profiles where id = buyer_id;
  if n <> 0 then raise exception 'ISOLATION_FAIL: proprietário lê profile do comprador'; end if;
  checks := checks + 2;

  -- 4. Corretor autorizado: é corretor, mas não lê contatos por SELECT ------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', broker_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  if not public.is_active_broker() then raise exception 'ISOLATION_FAIL: corretor autorizado não reconhecido'; end if;
  if public.is_master() then raise exception 'ISOLATION_FAIL: corretor é Master'; end if;
  select count(*) into n from public.contacts;
  if n <> 0 then raise exception 'ISOLATION_FAIL: corretor lê % contatos por SELECT direto', n; end if;
  begin
    perform public.set_user_status(buyer_id, 'bloqueado');
    raise exception 'ISOLATION_FAIL: corretor bloqueou usuário';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_broker_status(broker2_id, 'autorizado');
    raise exception 'ISOLATION_FAIL: corretor autorizou outro corretor';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 5;

  -- 5. Corretor bloqueado não é corretor ------------------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', broker2_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if public.is_active_broker() then raise exception 'ISOLATION_FAIL: corretor bloqueado continua ativo'; end if;
  checks := checks + 1;

  -- 6. Master enxerga a operação --------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', master_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  if not public.is_master() then raise exception 'ISOLATION_FAIL: Master não reconhecido'; end if;
  select count(*) into n from public.contacts where user_id in (master_id, broker_id, broker2_id, buyer_id, owner_id);
  if n <> 2 then raise exception 'ISOLATION_FAIL: Master lê % contatos, esperado 2', n; end if;
  select count(*) into n from public.profiles where id in (master_id, broker_id, broker2_id, buyer_id, owner_id);
  if n <> 5 then raise exception 'ISOLATION_FAIL: Master lê % profiles, esperado 5', n; end if;
  perform public.set_broker_status(broker2_id, 'autorizado');
  select count(*) into n from public.audit_log where action = 'broker.status' and target_id = broker2_id::text;
  if n <> 1 then raise exception 'ISOLATION_FAIL: set_broker_status não auditou'; end if;
  begin
    perform public.set_user_status(master_id, 'bloqueado');
    raise exception 'ISOLATION_FAIL: Master se auto-bloqueou';
  exception when others then
    if sqlerrm <> 'cannot_block_self' then
      raise exception 'ISOLATION_FAIL: auto-bloqueio deu %', sqlerrm;
    end if;
  end;
  checks := checks + 5;

  -- 7. anon não lê nada além das configurações públicas ---------------------
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;

  begin
    select count(*) into n from public.contacts;
    raise exception 'ISOLATION_FAIL: anon leu contacts (% linhas)', n;
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from public.profiles;
    raise exception 'ISOLATION_FAIL: anon leu profiles (% linhas)', n;
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.is_master();
    raise exception 'ISOLATION_FAIL: anon executou is_master()';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_broker_status(broker_id, 'autorizado');
    raise exception 'ISOLATION_FAIL: anon executou set_broker_status';
  exception when insufficient_privilege then null;
  end;
  -- O botão WhatsApp é público, então site_settings tem que ser legível.
  select count(*) into n from public.site_settings;
  if n <> 1 then raise exception 'ISOLATION_FAIL: anon não lê site_settings'; end if;
  checks := checks + 5;

  reset role;

  -- 8. Máscara anti-contato (§34) -------------------------------------------
  if private.mask_contacts('me liga (31) 99999-8888') not like '%[telefone removido]%'
    then raise exception 'ISOLATION_FAIL: máscara não pegou telefone com DDD'; end if;
  if private.mask_contacts('zap 31999998888 agora') !~ '\[(telefone|número) removido\]'
    then raise exception 'ISOLATION_FAIL: máscara não pegou telefone sem separador'; end if;
  if private.mask_contacts('manda pro fulano@gmail.com') not like '%[contato removido]%'
    then raise exception 'ISOLATION_FAIL: máscara não pegou e-mail'; end if;
  if private.mask_contacts('chama em wa.me/5531999998888') !~ '\[(link|número) removido\]'
    then raise exception 'ISOLATION_FAIL: máscara não pegou wa.me'; end if;
  if private.mask_contacts('veja https://instagram.com/fulano') not like '%[link removido]%'
    then raise exception 'ISOLATION_FAIL: máscara não pegou URL'; end if;
  if private.mask_contacts('meu insta @fulanodetal') not like '%[perfil removido]%'
    then raise exception 'ISOLATION_FAIL: máscara não pegou @handle'; end if;
  if private.mask_contacts('Casa com 3 quartos e 2 vagas') <> 'Casa com 3 quartos e 2 vagas'
    then raise exception 'ISOLATION_FAIL: máscara estragou texto legítimo: %',
      private.mask_contacts('Casa com 3 quartos e 2 vagas'); end if;
  if private.has_contact_info('Apartamento reformado') then
    raise exception 'ISOLATION_FAIL: has_contact_info deu falso positivo'; end if;
  if not private.has_contact_info('liga 31 99999-8888') then
    raise exception 'ISOLATION_FAIL: has_contact_info não detectou telefone'; end if;
  checks := checks + 9;

  -- 9. A máscara roda por trigger, não só quando o app lembra ---------------
  perform set_config('request.jwt.claims', json_build_object('sub', buyer_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.profiles set full_name = 'Comprador 31999998888' where id = buyer_id;
  reset role;
  select full_name into txt from public.profiles where id = buyer_id;
  if txt ~ '9999' then
    raise exception 'ISOLATION_FAIL: trigger deixou telefone no nome: %', txt;
  end if;
  select count(*) into n from public.audit_log where action = 'contact.masked';
  if n < 1 then raise exception 'ISOLATION_FAIL: máscara não registrou auditoria'; end if;
  checks := checks + 2;

  raise exception 'ISOLATION_OK: % verificações passaram', checks;
end $$;
