-- =============================================================================
-- imobi — faixa de preço pública.
--
-- DECISÃO DE PRODUTO (2026-10-05, Franklin): a busca pública precisa filtrar
-- por valor. Isso é uma exceção consciente aos §4 e §12, e vale registrar o
-- raciocínio, porque o código sozinho não explica por que a regra abriu:
--
--   Qualquer filtro por preço é um oráculo de preço. Dá para escolher a
--   RESOLUÇÃO do oráculo, não eliminá-lo. Com faixa livre (mín/máx digitados),
--   meia dúzia de buscas chegam ao valor quase exato de cada imóvel e o
--   "valor sob consulta" vira enfeite. Com faixas fixas e largas, o visitante
--   aprende só em qual das quatro faixas o imóvel está.
--
-- O que continua protegido, e é o que sustenta a intermediação (§35, §47):
-- o valor pedido, o mínimo aceitável, a entrada, as condições e a margem de
-- negociação. Nada disso sai de property_private.
--
-- A faixa é DERIVADA: ninguém a escreve. Vem por trigger do preço privado,
-- igual à coordenada aproximada. Assim não existe o estado em que a faixa
-- pública discorda do preço real.
-- =============================================================================

create type public.sale_band as enum
  ('ate_300k', 'de_300k_600k', 'de_600k_1mi', 'acima_1mi');

create type public.rent_band as enum
  ('ate_2k', 'de_2k_5k', 'de_5k_10k', 'acima_10k');

alter table public.properties
  add column sale_band public.sale_band,
  add column rent_band public.rent_band;

create index on public.properties (sale_band);
create index on public.properties (rent_band);

-- Quatro faixas. Mexer nos limites aqui muda a resolução do oráculo: quanto
-- mais faixas, mais perto de publicar o preço. Não aumente sem decisão
-- explícita do cliente.
create or replace function private.sale_band_of(_price numeric)
returns public.sale_band language sql immutable set search_path = '' as $$
  select case
    when _price is null then null
    when _price <  300000 then 'ate_300k'
    when _price <  600000 then 'de_300k_600k'
    when _price < 1000000 then 'de_600k_1mi'
    else 'acima_1mi'
  end::public.sale_band
$$;

create or replace function private.rent_band_of(_price numeric)
returns public.rent_band language sql immutable set search_path = '' as $$
  select case
    when _price is null then null
    when _price <  2000 then 'ate_2k'
    when _price <  5000 then 'de_2k_5k'
    when _price < 10000 then 'de_5k_10k'
    else 'acima_10k'
  end::public.rent_band
$$;

create or replace function private.tg_property_price_band() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.properties
     set sale_band = private.sale_band_of(new.price_sale),
         rent_band = private.rent_band_of(new.price_rent)
   where id = new.property_id;
  return new;
end $$;

create trigger property_private_price_band
  after insert or update of price_sale, price_rent on public.property_private
  for each row execute function private.tg_property_price_band();

grant execute on function
  private.sale_band_of(numeric), private.rent_band_of(numeric)
to authenticated;

-- A faixa é só de leitura. Não entra em nenhum GRANT de UPDATE: se o dono
-- pudesse escrevê-la, ela deixaria de ser derivada do preço e passaria a ser
-- mais um campo para manter em sincronia — e a primeira vez que saísse de
-- sincronia seria um anúncio na faixa errada.
