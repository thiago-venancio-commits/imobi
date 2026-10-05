// Mutation testing for the isolation suite.
//
// A test that passes proves nothing until you know it can fail. Each mutation
// below puts a real trap back into the migration — most of them taken from the
// kit's trap registry, which found them live in two of Franklin's apps — and
// the suite must go red for every one. A mutation that still passes means the
// test has a blind spot there.
import { freshDb, runTest, testFiles } from "./db-test.mjs";

/** @type {{name: string, from: string|RegExp, to: string, trap?: string}[]} */
const mutations = [
  {
    name: "contacts legíveis por qualquer autenticado",
    trap: "o comprador vê o WhatsApp do proprietário (§13)",
    from: "using (user_id = (select auth.uid()) or (select private.is_master()))\n  with check (user_id = (select auth.uid()));",
    to: "using (true)\n  with check (user_id = (select auth.uid()));",
  },
  {
    name: "profiles legíveis por qualquer autenticado",
    trap: "o proprietário identifica o comprador (§14)",
    from: "using (id = (select auth.uid()) or (select private.is_master()));",
    to: "using (true);",
  },
  {
    name: "candidato a corretor escolhe o próprio status",
    trap: "#1 do registro: papel do app vira papel de plataforma",
    from: "    and status = 'pendente'\n    and (select private.caller_active())\n  );\n\ncreate policy owner_profiles_select_self",
    to: "    and (select private.caller_active())\n  );\n\ncreate policy owner_profiles_select_self",
  },
  {
    name: "UPDATE de status liberado em brokers",
    trap: "#10: o usuário se promove dentro do próprio papel",
    from: "grant insert (user_id, creci, phone, bio, status) on public.brokers to authenticated;",
    to: "grant insert (user_id, creci, phone, bio, status), update (status) on public.brokers to authenticated;",
  },
  {
    name: "set_broker_status sem checar quem chama",
    trap: "#2: a função confia em quem mandou a requisição",
    from: "  if not private.is_master() then\n    raise exception 'forbidden' using errcode = '42501';\n  end if;\n  update public.brokers",
    to: "  update public.brokers",
  },
  {
    name: "RPCs executáveis por anon",
    trap: "#7: helper SECURITY DEFINER chamável direto pelo PostgREST",
    from: "revoke execute on all functions in schema public from public, anon;",
    to: "-- revoke removido pela mutação",
  },
  {
    name: "INSERT direto em platform_admins",
    trap: "#1: qualquer cadastro vira Master",
    from: "create policy platform_admins_select_self on public.platform_admins\n  for select to authenticated\n  using (user_id = (select auth.uid()));",
    to: "create policy platform_admins_select_self on public.platform_admins\n  for all to authenticated\n  using (true) with check (true);",
  },
  {
    name: "tabelas sem revoke (privilégios default do Supabase valem)",
    trap: "#3 da síntese: o PostgREST expõe toda permissão que existir",
    from: /revoke all on public\.profiles, public\.contacts[\s\S]*?from anon, authenticated;/,
    to: "-- revoke removido pela mutação",
  },
  {
    name: "máscara anti-contato desligada",
    trap: "§34: o telefone passa pelo campo de texto livre",
    from: "create trigger profiles_mask before insert or update on public.profiles\n  for each row execute function private.tg_mask_contacts('full_name');",
    to: "-- trigger removido pela mutação",
  },
  {
    // As duas regras de telefone se cobrem, então desligar só uma não abre
    // brecha nenhuma. A mutação derruba as duas de uma vez.
    name: "máscara cega para telefone",
    trap: "§34: '31999998888' escapa pelo campo de texto livre",
    from: /-- telefone BR[\s\S]*?'\[número removido\]', 'g'\),/,
    to: "'ZZZNUNCACASAZZZ',\n      '[telefone removido]', 'g'),\n      'ZZZNUNCACASAZZZ',\n      '[número removido]', 'g'),",
  },
  {
    name: "corretor bloqueado continua autorizado",
    trap: "§16: bloquear um corretor não tira o acesso dele",
    from: "where user_id = auth.uid() and status = 'autorizado'",
    to: "where user_id = auth.uid()",
  },
  {
    name: "audit_log legível por qualquer autenticado",
    trap: "§26: a auditoria mostra a operação inteira para quem não é Master",
    from: "create policy audit_log_select_master on public.audit_log\n  for select to authenticated\n  using ((select private.is_master()));",
    to: "create policy audit_log_select_master on public.audit_log\n  for select to authenticated\n  using (true);",
  },
  // ---- 0002: banco de oferta -------------------------------------------
  {
    name: "preço na metade pública do imóvel",
    trap: "§4/§12: o comprador lê o valor direto pelo PostgREST",
    file: "0002_offer.sql",
    from: "  views_count integer not null default 0,",
    to: `  views_count integer not null default 0,
  price_sale numeric(14,2),
  owner_id uuid,`,
  },
  {
    name: "property_private legível por qualquer autenticado",
    trap: "§12/§35: preço, mínimo aceitável e endereço vazam para o comprador",
    file: "0002_offer.sql",
    from: `create policy property_private_select on public.property_private
  for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_master()));`,
    to: `create policy property_private_select on public.property_private
  for select to authenticated
  using (true);`,
  },
  {
    name: "property_private legível por anon",
    trap: "§12: o valor sai na página pública sem nem precisar de login",
    file: "0002_offer.sql",
    from: "grant select on public.property_private to authenticated;",
    to: "grant select on public.property_private to authenticated, anon;",
  },
  {
    name: "imóvel não publicado aparece na vitrine",
    trap: "§7: anúncio sem aprovação do Master vai ao ar",
    file: "0002_offer.sql",
    from: "  select _status in ('publicado', 'reservado', 'em_negociacao')",
    to: "  select true",
  },
  {
    name: "dono publica o próprio imóvel",
    trap: "§7/§15: a aprovação do Master deixa de ser obrigatória",
    file: "0002_offer.sql",
    from: `grant update (type, purpose, condition, in_condominium, title, description,
  features, amenities, bedrooms, suites, bathrooms, parking_spaces,
  total_area, built_area, land_area, condo_fee, city, state, neighborhood,
  landmarks) on public.properties to authenticated;`,
    to: `grant update (type, purpose, condition, in_condominium, title, description,
  features, amenities, bedrooms, suites, bathrooms, parking_spaces,
  total_area, built_area, land_area, condo_fee, city, state, neighborhood,
  landmarks, status) on public.properties to authenticated;`,
  },
  {
    name: "set_property_status sem checar o Master",
    trap: "#2: qualquer autenticado publica ou vende imóvel alheio",
    file: "0002_offer.sql",
    from: `  if not private.is_master() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.properties
     set status = _status,`,
    to: `  update public.properties
     set status = _status,`,
  },
  {
    name: "coordenada pública é a exata",
    trap: "§6: o endereço do imóvel sai no mapa público",
    file: "0002_offer.sql",
    from: `  angle := new.geo_seed * 2 * pi();
  radius := 0.004;  -- ~450 m`,
    to: `  angle := 0;
  radius := 0;`,
  },
  {
    name: "qualquer um cadastra imóvel",
    trap: "§7/§8: some a aprovação do proprietário pelo Master",
    file: "0002_offer.sql",
    from: `  if not private.is_approved_owner() then
    raise exception 'owner_not_approved' using errcode = '42501';
  end if;`,
    to: "",
  },
  {
    name: "comissão editável pelo proprietário",
    trap: "§47: informação interna de comissão vira campo do dono",
    file: "0002_offer.sql",
    from: `grant update (price_sale, price_rent, min_price, down_payment,
  commercial_conditions, accepts_financing, accepts_trade, address,
  street_number, complement, cep, exact_lat, exact_lng, internal_notes)
  on public.property_private to authenticated;`,
    to: `grant update (price_sale, price_rent, min_price, down_payment,
  commercial_conditions, accepts_financing, accepts_trade, address,
  street_number, complement, cep, exact_lat, exact_lng, internal_notes,
  commission_pct) on public.property_private to authenticated;`,
  },
  {
    name: "editar anúncio publicado não pede reaprovação",
    trap: "§7: aprova-se um texto limpo e troca-se por outro com telefone",
    file: "0002_offer.sql",
    from: "  if private.property_is_public(old.status) and (",
    to: "  if false and (",
  },
  {
    name: "máscara desligada na descrição do anúncio",
    trap: "§34: o telefone do dono vai ao ar no anúncio",
    file: "0002_offer.sql",
    from: `create trigger properties_mask before insert or update on public.properties
  for each row execute function private.tg_mask_contacts('title', 'description', 'landmarks');`,
    to: "-- trigger removido pela mutação",
  },
  // ---- 0003: faixa de preco --------------------------------------------
  {
    name: "faixas estreitas viram o preco",
    trap: "o oraculo de faixa ganha resolucao e publica o valor (§4/§12)",
    file: "0003_price_bands.sql",
    from: "    when _price <  600000 then 'de_300k_600k'",
    to: "    when _price <  620000 then 'de_300k_600k'",
  },
  {
    name: "faixa escrevivel pelo proprietario",
    trap: "a faixa deixa de ser derivada e sai de sincronia com o preco real",
    file: "0003_price_bands.sql",
    from: `grant execute on function
  private.sale_band_of(numeric), private.rent_band_of(numeric)
to authenticated;`,
    to: `grant execute on function
  private.sale_band_of(numeric), private.rent_band_of(numeric)
to authenticated;
grant update (sale_band, rent_band) on public.properties to authenticated;`,
  },
  {
    name: "faixa nao acompanha o preco",
    trap: "o anuncio fica numa faixa e o preco em outra",
    file: "0003_price_bands.sql",
    from: `create trigger property_private_price_band
  after insert or update of price_sale, price_rent on public.property_private
  for each row execute function private.tg_property_price_band();`,
    to: `create trigger property_private_price_band
  after insert on public.property_private
  for each row execute function private.tg_property_price_band();`,
  },
];

const tests = testFiles();
let blind = 0;

for (const m of mutations) {
  let applied = false;
  const mutate = (sql, file) => {
    if (file !== (m.file ?? "0001_core.sql")) return sql;
    const next = sql.replace(m.from, m.to);
    if (next !== sql) applied = true;
    return next;
  };

  let caught = false;
  let detail = "";
  try {
    const db = await freshDb({ mutate });
    for (const { sql } of tests) {
      const { ok, message } = await runTest(db, sql);
      if (!ok) {
        caught = true;
        detail = message.replace(/^ISOLATION_FAIL:\s*/, "");
        break;
      }
    }
  } catch (e) {
    // A mutation that makes the migration itself invalid also counts as caught.
    caught = true;
    detail = `migration rejeitada: ${e.message}`;
  }

  if (!applied) {
    console.log(`SKIP  ${m.name}\n      padrão não encontrado — a mutação precisa ser atualizada`);
    blind++;
    continue;
  }

  if (caught) {
    console.log(`CAUGHT ${m.name}\n       → ${detail}`);
  } else {
    console.log(`BLIND  ${m.name}\n       trap: ${m.trap}\n       o teste passou mesmo com a brecha aberta`);
    blind++;
  }
}

console.log(
  blind
    ? `\n${blind} de ${mutations.length} mutações não foram detectadas`
    : `\ntodas as ${mutations.length} mutações foram detectadas`,
);
process.exitCode = blind ? 1 : 0;
