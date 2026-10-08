// Ponta a ponta do M2, num Chrome real, contra o servidor rodando e o banco
// Supabase dele:
//
//   proprietário se candidata → cadastra (CEP, valores, foto com GPS) → envia
//   → Master vê, não consegue publicar com o proprietário pendente, confere o
//   GPS da foto, aprova o proprietário, publica → o público vê o anúncio, sem
//   preço, sem endereço e com a foto limpa.
//
//   npm run e2e:owner        (lê .env.local; servidor em E2E_BASE_URL ou :3000)
//
// Cria um proprietário e um Master DESCARTÁVEIS pela API admin, com senhas
// aleatórias que não ficam gravadas em lugar nenhum, e apaga tudo no fim
// (usuários, imóvel e arquivos), mesmo se o teste falhar.
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SERVICE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (rode com --env-file=.env.local).");
  process.exit(2);
}
// Este roteiro PUBLICA um imóvel de teste no banco apontado pelo .env.local.
// Hoje esse banco é o de produção: durante a execução (cerca de um minuto) o
// imóvel aparece em www.tsvimoveis.com.br — foi o que aconteceu em 2026-10-08.
// Por isso ele só roda com confirmação explícita, até existir um projeto
// Supabase separado para testes.
if (process.env.E2E_ALLOW_LIVE_DB !== "1") {
  console.error(
    "Recusado: este teste publica um imóvel por ~1 minuto no banco do .env.local (hoje, PRODUÇÃO).\n" +
      "Rode contra um projeto de testes, ou confirme com E2E_ALLOW_LIVE_DB=1.",
  );
  process.exit(2);
}
const SHOTS = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(SHOTS, { recursive: true });

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}  ${detail}`); }
}

// --- Foto JPEG com GPS no EXIF ------------------------------------------------
// Av. Paulista, São Paulo. O teste confere que a cópia pública perde isto e o
// original guarda.
const GPS = { lat: -23.5614, lng: -46.6559 };

function exifGpsSegment({ lat, lng }) {
  const tiff = Buffer.alloc(128);
  tiff.write("MM", 0, "latin1");
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4); // IFD0
  // IFD0: uma entrada, o ponteiro para o GPS IFD (offset 26)
  tiff.writeUInt16BE(1, 8);
  tiff.writeUInt16BE(0x8825, 10); tiff.writeUInt16BE(4, 12); tiff.writeUInt32BE(1, 14); tiff.writeUInt32BE(26, 18);
  tiff.writeUInt32BE(0, 22);
  // GPS IFD: LatRef, Lat, LngRef, Lng
  const entry = (i, tag, type, count, value) => {
    const o = 28 + i * 12;
    tiff.writeUInt16BE(tag, o); tiff.writeUInt16BE(type, o + 2); tiff.writeUInt32BE(count, o + 4);
    if (typeof value === "string") tiff.write(value, o + 8, "latin1"); else tiff.writeUInt32BE(value, o + 8);
  };
  tiff.writeUInt16BE(4, 26);
  entry(0, 1, 2, 2, lat < 0 ? "S\0" : "N\0");
  entry(1, 2, 5, 3, 80);
  entry(2, 3, 2, 2, lng < 0 ? "W\0" : "E\0");
  entry(3, 4, 5, 3, 104);
  tiff.writeUInt32BE(0, 76);
  const dms = (v, at) => {
    const a = Math.abs(v); const d = Math.floor(a); const m = Math.floor((a - d) * 60);
    const s = Math.round(((a - d) * 60 - m) * 60 * 100);
    [[d, 1], [m, 1], [s, 100]].forEach(([n, den], i) => { tiff.writeUInt32BE(n, at + i * 8); tiff.writeUInt32BE(den, at + i * 8 + 4); });
  };
  dms(lat, 80); dms(lng, 104);
  const body = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const head = Buffer.alloc(4);
  head.writeUInt16BE(0xffe1, 0); head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
}

// --- Montagem --------------------------------------------------------------
const tag = randomBytes(4).toString("hex");
const TITLE = `Casa E2E ${tag}`;
const PRICE = "987.654"; // valor único, para procurar vazamento no HTML
const users = {};
let propertyId = null;

async function makeUser(kind) {
  const email = `e2e-${kind}-${tag}@imobi-test.invalid`;
  const password = `${randomBytes(12).toString("base64url")}a1`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: `E2E ${kind} ${tag}` },
  });
  if (error) throw new Error(`createUser ${kind}: ${error.message}`);
  return { id: data.user.id, email, password };
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

async function session(user) {
  const ctx = await browser.newContext({ locale: "pt-BR" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);
  // Erros do navegador (inclusive os que o overlay de dev do Next mostra como
  // "Issue") entram no relatório final.
  page.on("pageerror", (e) => consoleErrors.push(`${page.url()} :: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`${page.url()} :: ${m.text()}`);
  });
  if (user) {
    // Login por link de uso único gerado pela API admin, aberto na tela de
    // confirmação do próprio site. O formulário de senha tem Turnstile, que um
    // navegador automatizado não passa — e é para não passar. A confirmação do
    // link não pede captcha (quem pede é a SOLICITAÇÃO do link, feita aqui
    // pela API admin).
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
    if (error) throw new Error(`generateLink: ${error.message}`);
    await page.goto(`${BASE}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`);
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/auth/confirm")), page.click("button[type=submit]")]);
  }
  return { ctx, page };
}

const latin1 = (buf) => Buffer.from(buf).toString("latin1");
const consoleErrors = [];

try {
  users.owner = await makeUser("owner");
  users.master = await makeUser("master");
  {
    const { error } = await admin.from("platform_admins").insert({ user_id: users.master.id });
    if (error) throw new Error(`platform_admins: ${error.message}`);
  }

  // 1. Candidatura ----------------------------------------------------------
  const owner = await session(users.owner);
  {
    const { page } = owner;
    await page.goto(`${BASE}/anunciar`);
    await page.fill("#phone", "(11) 98888-7777");
    await page.check("input[name=declare]");
    await Promise.all([page.waitForURL("**/proprietario/imoveis/novo"), page.click("button[type=submit]")]);
    check("candidatura leva ao cadastro do imóvel", page.url().endsWith("/proprietario/imoveis/novo"));
    check("aviso de cadastro em análise aparece", (await page.textContent("body")).includes("em análise"));
  }

  // 2. Novo imóvel ----------------------------------------------------------
  {
    const { page } = owner;
    await page.selectOption("#type", "casa");
    await page.selectOption("#purpose", "venda");
    await page.fill("#title", TITLE);
    await Promise.all([page.waitForURL("**/proprietario/imoveis/*?novo=1"), page.click("button[type=submit]")]);
    propertyId = new URL(page.url()).pathname.split("/").pop();
    check("imóvel criado como rascunho", (await page.textContent("body")).includes("Rascunho"), page.url());

    // Envio incompleto: o banco diz o que falta.
    await page.click("aside button[type=submit]");
    await page.waitForSelector("aside [role=alert]");
    const msg = await page.textContent("aside [role=alert]");
    check("envio incompleto lista o que falta", msg.includes("falta preencher") && msg.includes("foto"), msg);
  }

  // 3. Localização pelo CEP --------------------------------------------------
  {
    const { page } = owner;
    await page.fill("#cep", "01310-100");
    await page.locator("#cep").blur();
    await page.waitForFunction(() => document.querySelector("#address")?.value?.includes("Paulista"), null, { timeout: 15000 });
    check("CEP preenche rua, bairro e cidade", (await page.inputValue("#city")) === "São Paulo", await page.inputValue("#city"));
    await page.fill("#streetNumber", "1578");
    await page.click("#localizacao button[type=submit]");
    await page.waitForSelector("#localizacao [role=status]");
    check("endereço salvo", (await page.textContent("#localizacao [role=status]")).includes("Endereço salvo"));
  }

  // 4. Valores ---------------------------------------------------------------
  {
    const { page } = owner;
    await page.fill("#priceSale", PRICE);
    await page.click("#valores button[type=submit]");
    await page.waitForSelector("#valores [role=status]");
    check("valor salvo", (await page.textContent("#valores [role=status]")).includes("Valores salvos"));
  }

  // 5. Foto com GPS ----------------------------------------------------------
  {
    const { page } = owner;
    const dataUrl = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 800; c.height = 600;
      const g = c.getContext("2d");
      g.fillStyle = "#1d4ed8"; g.fillRect(0, 0, 800, 600);
      g.fillStyle = "#fff"; g.font = "48px sans-serif"; g.fillText("Foto de teste", 220, 320);
      return c.toDataURL("image/jpeg", 0.9);
    });
    const plain = Buffer.from(dataUrl.split(",")[1], "base64");
    const withGps = Buffer.concat([plain.subarray(0, 2), exifGpsSegment(GPS), plain.subarray(2)]);
    await page.setInputFiles("[data-testid=media-input]", [
      { name: "sala.jpg", mimeType: "image/jpeg", buffer: withGps },
      { name: "quarto.jpg", mimeType: "image/jpeg", buffer: plain },
    ]);
    await page.waitForFunction(() => document.querySelectorAll("#fotos li img").length === 2, null, { timeout: 90000 });
    check("as duas fotos aparecem na galeria", true);

    const { data: media } = await admin
      .from("property_media")
      .select("storage_path, property_media_originals(storage_path)")
      .eq("property_id", propertyId)
      .order("position");
    const pub = media?.[0]?.storage_path;
    const orig = media?.[0]?.property_media_originals?.[0]?.storage_path;
    check("foto registrada com original separado", Boolean(pub && orig && orig.startsWith(`${propertyId}/originais/`)), JSON.stringify(media));

    const publicBytes = await (await fetch(`${URL_}/storage/v1/object/public/property-media/${pub}`)).arrayBuffer();
    check("cópia PÚBLICA não tem EXIF", !latin1(publicBytes).includes("Exif"));
    const { data: origBlob } = await admin.storage.from("property-docs").download(orig);
    check("ORIGINAL privado mantém o EXIF com GPS", latin1(await origBlob.arrayBuffer()).includes("Exif"));
    const anonOrig = await fetch(`${URL_}/storage/v1/object/public/property-docs/${orig}`);
    check("original não abre por URL pública", anonOrig.status >= 400, String(anonOrig.status));

    // O aviso de erro do primeiro envio ainda está na tela: espera o texto mudar.
    const before = await page.textContent("aside");
    await page.click("aside button[type=submit]");
    await page.waitForFunction((prev) => {
      const t = document.querySelector("aside")?.textContent ?? "";
      return t !== prev && !t.includes("Enviando...");
    }, before);
    const aside = await page.textContent("aside");
    // Com sucesso a página recarrega já "em análise", e o botão some.
    check("envio para aprovação aceito", aside.includes("Em análise") || aside.includes("Enviado"), aside);
    await page.screenshot({ path: SHOTS + "m2-01-proprietario.png", fullPage: true });
  }

  const { data: prop } = await admin.from("properties").select("code, status").eq("id", propertyId).single();
  check("imóvel na fila de aprovação", prop.status === "aguardando_aprovacao", prop.status);

  // 6. Público ainda não vê --------------------------------------------------
  {
    const res = await fetch(`${BASE}/imoveis/${prop.code}`);
    check("anúncio não aprovado dá 404 no site", res.status === 404, String(res.status));
  }

  // 7. Master ------------------------------------------------------------------
  const master = await session(users.master);
  {
    const { page } = master;
    check("Master entra direto no painel", new URL(page.url()).pathname === "/master", page.url());
    await page.goto(`${BASE}/master/imoveis`);
    check("imóvel aparece na fila do Master", (await page.textContent("body")).includes(TITLE));

    await page.goto(`${BASE}/master/imoveis/${propertyId}`);
    const body = await page.textContent("body");
    check("Master vê o valor e o endereço internos", body.includes("987.654") && body.includes("Paulista"));
    check("publicar bloqueado com proprietário pendente", body.includes("Aprove o proprietário antes de publicar"));
    check("botão de publicar não aparece", (await page.locator("text=Aprovar e publicar").count()) === 0);

    await page.click("text=Conferir localização das mídias");
    await page.waitForSelector("text=/capturada a|GPS -23|sem GPS/", { timeout: 60000 });
    const gpsLine = await page.textContent("ul:has-text('Foto 1')");
    check("GPS do original lido e comparado ao endereço", /capturada a .* do endereço informado/.test(gpsLine), gpsLine);
    await page.screenshot({ path: SHOTS + "m2-02-master-revisao.png", fullPage: true });

    await page.goto(`${BASE}/master/proprietarios?status=pendente`);
    const row = page.locator(`li[id="${users.owner.id}"]`);
    check("candidato aparece com e-mail e telefone", (await row.textContent()).includes(users.owner.email) && (await row.textContent()).includes("(11) 98888-7777"));
    await row.locator("button:has-text('Aprovar')").click();
    await page.waitForFunction((id) => !document.getElementById(id), users.owner.id);
    check("proprietário aprovado sai da fila", true);

    await page.goto(`${BASE}/master/imoveis/${propertyId}`);
    await page.click("text=Aprovar e publicar");
    await page.waitForSelector("text=Status atualizado");
    check("Master publica o imóvel", true);

    // Master troca a capa para a segunda foto.
    const before = await admin.from("property_media").select("id, is_cover").eq("property_id", propertyId).order("position");
    await Promise.all([page.waitForLoadState("load"), page.click("button:has-text('Usar como capa')")]);
    await page.waitForFunction(() => !document.querySelector("button[type=submit][disabled]"));
    await page.waitForTimeout(1500);
    const after = await admin.from("property_media").select("id, is_cover").eq("property_id", propertyId).order("position");
    check(
      "Master troca a foto de capa",
      before.data?.[0]?.is_cover === true && after.data?.[1]?.is_cover === true && after.data?.[0]?.is_cover === false,
      JSON.stringify(after.data),
    );
    const { data: still } = await admin.from("properties").select("status").eq("id", propertyId).single();
    check("trocar a capa não tira o anúncio do ar", still.status === "publicado", still.status);

    // "Em negociação" vira selo no anúncio.
    await page.selectOption("#status-other", "em_negociacao");
    await page.click("form:has(#status-other) button[type=submit]");
    await page.waitForSelector("text=Status atualizado");
  }

  // 8. Público -----------------------------------------------------------------
  {
    const { ctx, page } = await session(null);
    await page.goto(`${BASE}/imoveis`);
    check("anúncio aparece na listagem", (await page.textContent("body")).includes(TITLE));
    const card = page.locator(`article:has-text("${TITLE}")`);
    check("card mostra o selo Em negociação", (await card.textContent()).includes("Em negociação"));

    const html = await (await fetch(`${BASE}/imoveis/${prop.code}`)).text();
    const rsc = await (await fetch(`${BASE}/imoveis/${prop.code}`, { headers: { RSC: "1" } })).text();
    for (const [label, text] of [["HTML", html], ["payload RSC", rsc]]) {
      check(`${label}: sem o valor`, !/987[.,]?654/.test(text));
      check(`${label}: sem rua nem número`, !text.includes("Paulista") && !text.includes("1578"));
      check(`${label}: sem caminho de original`, !text.includes("/originais/"));
    }
    check("página mostra valor sob consulta", html.includes("Sob consulta"));
    check("página mostra o selo e o aviso de negociação", html.includes("Em negociação") && html.includes("já está em negociação"));
    const { data: cover } = await admin.from("property_media").select("storage_path").eq("property_id", propertyId).eq("is_cover", true).single();
    check("prévia do WhatsApp usa a capa nova", html.includes(cover.storage_path), cover.storage_path);
    check("página mostra a faixa de preço", html.includes("R$ 600 mil a R$ 1 milhão"));
    check("prévia do WhatsApp tem a foto de capa", /property="og:image" content="[^"]*property-media/.test(html));

    await page.goto(`${BASE}/imoveis/${prop.code}`);
    await page.screenshot({ path: SHOTS + "m2-03-anuncio.png", fullPage: true });
    await ctx.close();
  }

  await owner.ctx.close();
  await master.ctx.close();
} catch (e) {
  fail++;
  console.log(`FAIL  exceção: ${e.message}`);
} finally {
  // Limpeza: arquivos, imóvel, usuários. Tudo deste teste, nada além.
  if (propertyId) {
    for (const bucket of ["property-media", "property-docs"]) {
      for (const folder of [propertyId, `${propertyId}/originais`, `${propertyId}/documentos`]) {
        const { data } = await admin.storage.from(bucket).list(folder);
        const files = (data ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
        if (files.length) await admin.storage.from(bucket).remove(files);
      }
    }
    await admin.from("properties").delete().eq("id", propertyId);
  }
  for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  await browser.close();
  const unique = [...new Set(consoleErrors)];
  if (unique.length) console.log(`\nErros no console do navegador (${unique.length}):\n  ${unique.join("\n  ")}`);
  console.log(`\n${pass} ok, ${fail} falhando`);
  process.exitCode = fail ? 1 : 0;
}
