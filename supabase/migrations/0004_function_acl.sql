-- =============================================================================
-- imobi — fecha o EXECUTE de PUBLIC nas funções.
--
-- Causa: o Postgres concede EXECUTE a PUBLIC em toda função nova. A migration
-- 0001 fazia `alter default privileges ... in schema public revoke ... from
-- public`, mas isso só edita a lista POR SCHEMA e não remove o grant embutido
-- de PUBLIC. O `revoke ... on all functions` da 0001 só alcançou as funções que
-- já existiam naquele momento; tudo criado na 0002 e na 0003 nasceu executável
-- por anon.
--
-- Impacto real: nenhum dado foi alcançável, porque cada RPC checa o chamador
-- dentro do corpo. Mas a primeira barreira (o GRANT) não existia, e a regra de
-- defesa em profundidade do projeto diz que o corpo é a segunda, não a única.
-- =============================================================================

-- Funções que já existem ------------------------------------------------------
revoke execute on all functions in schema public  from public, anon;
revoke execute on all functions in schema private from public, anon;

-- Exceções deliberadas, as únicas que anon pode executar.
-- Contador de visualizações: não lê nem revela nada.
grant execute on function public.register_property_view(uuid) to anon, authenticated;
-- A policy de leitura da vitrine avalia esta função como anon. Sem EXECUTE a
-- página pública deixa de listar imóveis.
grant execute on function private.property_is_public(public.property_status) to anon, authenticated;

-- Funções futuras --------------------------------------------------------------
-- Sem `in schema`: é o default GLOBAL que concede EXECUTE a PUBLIC, e só ele
-- pode ser revogado assim. Daqui para frente, cada função nova precisa de um
-- GRANT explícito — esquecer dá erro visível, não um buraco silencioso.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema private revoke execute on functions from anon;
