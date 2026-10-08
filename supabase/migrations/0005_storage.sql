-- =============================================================================
-- imobi — Storage: fotos e documentos dos imóveis.
--
-- Dois buckets, com propósitos opostos:
--   property-media  PÚBLICO. Fotos e vídeos do anúncio; a vitrine e o Google
--                   precisam carregá-los sem login.
--   property-docs   PRIVADO. Escritura, IPTU, matrícula. Só dono e Master.
--
-- Caminho: {property_id}/{arquivo}. A primeira pasta decide a permissão de
-- escrita — e ela vem do banco (property_private.owner_id), nunca de quem
-- fez o upload dizer de quem é.
--
-- DECISÃO sobre fotos de imóveis ainda não aprovados: o bucket é público, então
-- quem souber o caminho completo baixa a foto, publicado ou não. O que impede a
-- descoberta é que (1) o caminho tem UUID do imóvel + nome aleatório, e (2) os
-- caminhos só existem em property_media e storage.objects, e ambos só listam
-- para dono, equipe ou — no caso de property_media — imóvel publicado.
-- Ninguém de fora consegue LISTAR. A alternativa (bucket privado + URL
-- assinada) tiraria cache e SEO da vitrine para proteger fotos que, no fluxo
-- normal, vão ser públicas de qualquer jeito depois da aprovação.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- 50 MB é o teto do plano gratuito do Supabase; fotos já chegam comprimidas
  -- pelo navegador, então o limite na prática é para vídeo.
  ('property-media', 'property-media', true, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('property-docs', 'property-docs', false, 10485760,
   array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Id do imóvel a partir do caminho, ou null se a primeira pasta não for um
-- UUID. Não lança erro: um cast inválido dentro de uma policy derrubaria a
-- consulta inteira em vez de só negar aquela linha.
create or replace function private.storage_property_id(_name text)
returns uuid language plpgsql immutable set search_path = '' as $$
declare
  seg text := split_part(coalesce(_name, ''), '/', 1);
begin
  -- Exige pelo menos "pasta/arquivo": um objeto solto na raiz não pertence a
  -- imóvel nenhum.
  if position('/' in coalesce(_name, '')) = 0 then
    return null;
  end if;
  if seg ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return seg::uuid;
  end if;
  return null;
end $$;

-- Quem chama pode gerenciar os arquivos deste caminho? Dono ATIVO do imóvel, ou
-- o Master. Sem parâmetro de usuário: sempre "quem está chamando".
create or replace function private.can_manage_property_files(_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.caller_active() and (
    private.is_master()
    or coalesce(private.owns_property(private.storage_property_id(_name)), false)
  )
$$;

-- A 0004 tirou o EXECUTE padrão de PUBLIC, então cada função nova precisa de
-- GRANT explícito. As policies abaixo rodam como `authenticated`.
grant execute on function
  private.storage_property_id(text), private.can_manage_property_files(text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Policies em storage.objects
--
-- Nenhuma policy para anon: fotos públicas são servidas pela URL pública do
-- bucket, que não passa por aqui. SELECT para anon permitiria LISTAR o bucket
-- e achar fotos de imóveis ainda não aprovados.
-- ---------------------------------------------------------------------------
create policy imobi_media_select on storage.objects
  for select to authenticated
  using (bucket_id = 'property-media' and private.can_manage_property_files(name));

create policy imobi_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'property-media' and private.can_manage_property_files(name));

create policy imobi_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'property-media' and private.can_manage_property_files(name))
  with check (bucket_id = 'property-media' and private.can_manage_property_files(name));

create policy imobi_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'property-media' and private.can_manage_property_files(name));

create policy imobi_docs_select on storage.objects
  for select to authenticated
  using (bucket_id = 'property-docs' and private.can_manage_property_files(name));

create policy imobi_docs_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'property-docs' and private.can_manage_property_files(name));

create policy imobi_docs_update on storage.objects
  for update to authenticated
  using (bucket_id = 'property-docs' and private.can_manage_property_files(name))
  with check (bucket_id = 'property-docs' and private.can_manage_property_files(name));

create policy imobi_docs_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'property-docs' and private.can_manage_property_files(name));

-- ---------------------------------------------------------------------------
-- O registro do arquivo aponta para a pasta do próprio imóvel
--
-- Sem isso, o dono do imóvel A poderia cadastrar em property_media o caminho
-- de uma foto do imóvel B, e o anúncio A exibiria a foto de B.
-- ---------------------------------------------------------------------------
alter table public.property_media
  add constraint property_media_path_matches_property
  check (storage_path like property_id::text || '/%');

alter table public.property_documents
  add constraint property_documents_path_matches_property
  check (storage_path like property_id::text || '/%');
