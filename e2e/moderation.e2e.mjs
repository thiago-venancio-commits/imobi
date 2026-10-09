// Moderação pelo Master, num Chrome real: anúncio bloqueado na visão do dono e
// exclusão definitiva (linhas + arquivos + auditoria).
//
//   npm run e2e:moderation        (lê .env.local; servidor em E2E_BASE_URL ou :3000)
//
// Diferente do e2e:owner, este roteiro NUNCA publica nada: o imóvel de teste é
// um rascunho criado pela API admin, invisível no site. Por isso pode rodar
// contra o banco de produção sem aparecer na vitrine. A regra "bloqueado some
// da vitrine" é garantida no banco e testada em supabase/tests/0009.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SERVICE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (rode com --env-file=.env.local).");
  process.exit(2);
}
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}  ${detail}`); }
}

const tag = randomBytes(4).toString("hex");
const users = {};
let propertyId = null;

async function makeUser(kind) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `e2e-${kind}-${tag}@imobi-test.invalid`,
    password: `${randomBytes(12).toString("base64url")}a1`,
    email_confirm: true,
    user_metadata: { full_name: `E2E ${kind} ${tag}` },
  });
  if (error) throw new Error(`createUser ${kind}: ${error.message}`);
  return { id: data.user.id, email: data.user.email };
}

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    (process.platform === "win32"
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : "/usr/bin/google-chrome"),
  headless: true,
});

/** Login por link de uso único (o formulário tem Turnstile, que bloqueia automação). */
async function session(user) {
  const ctx = await browser.newContext({ locale: "pt-BR" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
  if (error) throw new Error(`generateLink: ${error.message}`);
  await page.goto(`${BASE}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/auth/confirm")), page.click("button[type=submit]")]);
  return { ctx, page };
}

async function listAll(bucket) {
  const out = [];
  for (const folder of [propertyId, `${propertyId}/originais`, `${propertyId}/documentos`]) {
    const { data } = await admin.storage.from(bucket).list(folder);
    for (const f of data ?? []) if (f.id) out.push(`${folder}/${f.name}`);
  }
  return out;
}

try {
  users.owner = await makeUser("owner");
  users.master = await makeUser("master");
  await admin.from("platform_admins").insert({ user_id: users.master.id });
  await admin.from("owner_profiles").insert({ user_id: users.owner.id, status: "aprovado" });

  // Rascunho com foto, original e documento — criado pela API admin, nunca publicado.
  const { data: prop, error: pErr } = await admin
    .from("properties")
    .insert({ type: "casa", purpose: "venda", title: `Moderação ${tag}`, status: "pausado", city: "BH", state: "MG", neighborhood: "Centro" })
    .select("id, code")
    .single();
  if (pErr) throw new Error(`insert property: ${pErr.message}`);
  propertyId = prop.id;
  await admin.from("property_private").insert({ property_id: propertyId, owner_id: users.owner.id, price_sale: 450000 });
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  await admin.storage.from("property-media").upload(`${propertyId}/foto.jpg`, jpg, { contentType: "image/jpeg" });
  await admin.storage.from("property-docs").upload(`${propertyId}/originais/foto.jpg`, jpg, { contentType: "image/jpeg" });
  await admin.storage.from("property-docs").upload(`${propertyId}/documentos/iptu.pdf`, Buffer.from("%PDF-1.4\n%%EOF"), { contentType: "application/pdf" });
  const { data: media } = await admin
    .from("property_media")
    .insert({ property_id: propertyId, storage_path: `${propertyId}/foto.jpg`, is_cover: true })
    .select("id")
    .single();
  await admin.from("property_media_originals").insert({ media_id: media.id, property_id: propertyId, storage_path: `${propertyId}/originais/foto.jpg` });
  await admin.from("property_documents").insert({ property_id: propertyId, storage_path: `${propertyId}/documentos/iptu.pdf`, label: "IPTU" });
  check("montagem: 1 foto pública + 2 arquivos privados", (await listAll("property-media")).length === 1 && (await listAll("property-docs")).length === 2);

  // 1. Dono vê o bloqueio e não tem como reenviar -----------------------------
  {
    const { ctx, page } = await session(users.owner);
    await page.goto(`${BASE}/proprietario/imoveis/${propertyId}`);
    const aside = await page.textContent("aside");
    check("dono vê 'Bloqueado' e o aviso da equipe", aside.includes("bloqueado pela equipe"), aside);
    check("dono não tem botão de reenviar", (await page.locator("aside button[type=submit]").count()) === 0);
    await ctx.close();
  }

  // 2. Master: código errado não exclui; código certo exclui tudo ------------
  {
    const { ctx, page } = await session(users.master);
    await page.goto(`${BASE}/master/imoveis/${propertyId}`);
    check("Master vê o botão de desbloquear", (await page.textContent("body")).includes("Desbloquear e publicar"));

    await page.click("text=Excluir anúncio definitivamente...");
    await page.fill("#confirmCode", "IMB-99999");
    await page.click("button:has-text('Excluir para sempre')");
    await page.waitForSelector("#confirmCode-error");
    const { count } = await admin.from("properties").select("*", { count: "exact", head: true }).eq("id", propertyId);
    check("código errado não exclui", count === 1, String(count));

    await page.fill("#confirmCode", prop.code);
    await Promise.all([page.waitForURL("**/master/imoveis?status=todos"), page.click("button:has-text('Excluir para sempre')")]);
    check("após excluir, volta para a lista", true);
    await ctx.close();
  }

  const tables = {};
  for (const t of ["properties", "property_private", "property_media", "property_documents", "property_media_originals"]) {
    const col = t === "properties" ? "id" : "property_id";
    const { count } = await admin.from(t).select("*", { count: "exact", head: true }).eq(col, propertyId);
    tables[t] = count;
  }
  check("nenhuma linha do imóvel sobrou", Object.values(tables).every((n) => n === 0), JSON.stringify(tables));
  check("foto pública apagada do Storage", (await listAll("property-media")).length === 0);
  check("original e documento apagados do Storage", (await listAll("property-docs")).length === 0);
  const { data: audit } = await admin
    .from("audit_log")
    .select("actor_id, metadata")
    .eq("action", "property.deleted")
    .eq("target_id", propertyId);
  check(
    "exclusão registrada na auditoria, com autor e código",
    audit?.length === 1 && audit[0].actor_id === users.master.id && audit[0].metadata?.code === prop.code,
    JSON.stringify(audit),
  );
} catch (e) {
  fail++;
  console.log(`FAIL  exceção: ${e.message}`);
} finally {
  if (propertyId) {
    for (const bucket of ["property-media", "property-docs"]) {
      const files = await listAll(bucket);
      if (files.length) await admin.storage.from(bucket).remove(files);
    }
    await admin.from("properties").delete().eq("id", propertyId);
  }
  for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  await browser.close();
  console.log(`\n${pass} ok, ${fail} falhando`);
  process.exitCode = fail ? 1 : 0;
}
