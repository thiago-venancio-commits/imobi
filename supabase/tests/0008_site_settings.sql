-- =============================================================================
-- imobi — configuração da operação: só o Master altera.
--
-- O número de WhatsApp desta tabela é para onde o botão TENHO INTERESSE de
-- todos os anúncios aponta. Se outro usuário conseguisse trocá-lo, desviaria
-- todos os interessados para si — exatamente o contato direto que a
-- plataforma existe para impedir (§41).
-- =============================================================================
do $$
declare
  v_master uuid := gen_random_uuid();
  v_owner  uuid := gen_random_uuid();
  n int; checks int := 0; txt text;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_master,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','m8@test.invalid',now(),'{}','{}'),
    (v_owner, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','o9@test.invalid',now(),'{}','{}');
  insert into public.platform_admins (user_id) values (v_master);
  insert into public.owner_profiles (user_id, status) values (v_owner, 'aprovado');

  -- 1. Outro usuário não troca o WhatsApp do Master --------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner,'role','authenticated')::text, true);
  set local role authenticated;
  update public.site_settings set master_whatsapp = '5531900000000';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ISOLATION_FAIL: proprietário trocou o WhatsApp do Master'; end if;
  checks := checks + 1;

  -- 2. anon nem tenta ---------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  begin
    update public.site_settings set master_whatsapp = '5531900000000';
    raise exception 'ISOLATION_FAIL: anon alterou a configuração';
  exception when insufficient_privilege then null;
  end;
  checks := checks + 1;

  -- 3. O Master altera --------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_master,'role','authenticated')::text, true);
  set local role authenticated;
  update public.site_settings set master_whatsapp = '5531988887777';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ISOLATION_FAIL: Master não consegue salvar a configuração'; end if;
  select master_whatsapp into txt from public.site_settings;
  if txt <> '5531988887777' then raise exception 'ISOLATION_FAIL: configuração não gravou'; end if;
  checks := checks + 2;

  raise exception 'ISOLATION_OK: % verificações passaram', checks;
end $$;
