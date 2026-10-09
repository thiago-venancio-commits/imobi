-- =============================================================================
-- imobi — ACL de funções, lida do catálogo.
--
-- Por que este teste existe: "anon chama a RPC e leva 42501" NÃO prova que o
-- anon não pode executá-la. `permission denied for function` e o `raise
-- exception 'forbidden'` de dentro do corpo usam o mesmo código (42501), então
-- um teste que só captura a exceção passa nos dois casos. Foi exatamente o que
-- aconteceu: cinco RPCs ficaram executáveis por anon e a recusa vinha só do
-- corpo da função. Aqui a pergunta é feita ao catálogo, sem chamar nada.
--
-- Defesa em profundidade: o GRANT é a primeira barreira, o corpo é a segunda.
-- Uma migration futura que esqueça o revoke deixa este teste vermelho.
-- =============================================================================
do $$
declare
  r record; checks int := 0; n int;
  -- Únicas funções que anon pode executar, e por quê:
  --   public.register_property_view   contador de visualizações, não revela nada
  --   private.property_is_public      a policy de leitura da vitrine a avalia
  --                                   como anon; sem EXECUTE a vitrine quebra
  public_allow text[]  := array['register_property_view'];
  private_allow text[] := array['property_is_public'];
begin
  -- 1. Nenhuma função de public é executável por anon, salvo a lista ---------
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')
      and p.proname <> all (public_allow)
  loop
    raise exception 'ISOLATION_FAIL: public.%(%) é executável por anon', r.proname, r.args;
  end loop;
  checks := checks + 1;

  -- 2. Idem para o schema private -------------------------------------------
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'private'
      and has_function_privilege('anon', p.oid, 'execute')
      and p.proname <> all (private_allow)
  loop
    raise exception 'ISOLATION_FAIL: private.%(%) é executável por anon', r.proname, r.args;
  end loop;
  checks := checks + 1;

  -- 3. As exceções continuam existindo: sem elas a vitrine quebra ------------
  if not has_function_privilege('anon', 'private.property_is_public(public.property_status)', 'execute') then
    raise exception 'ISOLATION_FAIL: anon perdeu EXECUTE em property_is_public — a vitrine pública quebra';
  end if;
  if not has_function_privilege('anon', 'public.register_property_view(uuid)', 'execute') then
    raise exception 'ISOLATION_FAIL: anon perdeu EXECUTE em register_property_view';
  end if;
  checks := checks + 2;

  -- 4. Quem precisa continua conseguindo (authenticated) ---------------------
  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname in ('create_property','set_property_status','submit_property',
                      'is_master','my_roles','set_broker_status',
                      'apply_as_owner','master_owners','delete_property')
    and has_function_privilege('authenticated', p.oid, 'execute');
  if n <> 9 then
    raise exception 'ISOLATION_FAIL: authenticated perdeu EXECUTE em RPCs do app (% de 9)', n;
  end if;
  checks := checks + 1;

  -- 5. Funções futuras não herdam EXECUTE de PUBLIC --------------------------
  -- Cria uma função nova como esta sessão (o dono das migrations) e confere.
  create function public.__acl_probe() returns int language sql as 'select 1';
  if has_function_privilege('anon', 'public.__acl_probe()', 'execute') then
    raise exception 'ISOLATION_FAIL: função nova nasce executável por anon (default privileges de PUBLIC não foram revogados)';
  end if;
  checks := checks + 1;

  raise exception 'ISOLATION_OK: % verificações passaram', checks;
end $$;
