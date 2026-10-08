// Teste de ponta a ponta da autenticação, num navegador real, contra um
// servidor rodando (por padrão o dev server local) e o banco Supabase dele.
//
//   E2E_EMAIL=... E2E_PASSWORD=... npm run e2e:auth
//
// Precisa de um usuário JÁ CONFIRMADO, ativo, sem papel de Master/corretor/
// proprietário, com nome "Usuário de Teste". Usa o Chrome instalado na
// máquina (playwright-core não baixa navegador); CHROME_PATH sobrescreve.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL;
const PW = process.env.E2E_PASSWORD;
if (!EMAIL || !PW) {
  console.error("Defina E2E_EMAIL e E2E_PASSWORD (usuário de teste confirmado).");
  process.exit(2);
}
const SHOTS = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(SHOTS, { recursive: true });

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

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}  ${detail}`); }
}

async function fresh() {
  const ctx = await browser.newContext({ locale: "pt-BR" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  return { ctx, page };
}

async function login(page, email, password, next) {
  await page.goto(`${BASE}/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  // Não dá para esperar "networkidle": o iframe do Turnstile fica consultando a
  // Cloudflare. Espera sair do /entrar ou aparecer o aviso do formulário.
  await page.click("button[type=submit]");
  await page.waitForFunction(
    () => location.pathname !== "/entrar" || !document.querySelector("button[type=submit][disabled]"),
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(500);
}

try {
  // 1. Página protegida sem sessão → login, com volta garantida.
  {
    const { ctx, page } = await fresh();
    await page.goto(`${BASE}/minha-conta`);
    const u = new URL(page.url());
    check("sem sessão, /minha-conta manda para /entrar", u.pathname === "/entrar", page.url());
    check("…preservando o destino em ?next", u.searchParams.get("next") === "/minha-conta", page.url());
    await ctx.close();
  }

  // 2. Senha errada → mensagem genérica, e-mail preservado, senha não.
  {
    const { ctx, page } = await fresh();
    await login(page, EMAIL, "SenhaErrada123");
    const text = await page.textContent("body");
    check("senha errada mostra mensagem genérica", text.includes("E-mail ou senha incorretos."));
    check("…e mantém o e-mail digitado", (await page.inputValue("#email")) === EMAIL);
    check("…mas não devolve a senha", (await page.inputValue("#password")) === "");
    check("…e continua em /entrar", new URL(page.url()).pathname === "/entrar");
    await page.screenshot({ path: SHOTS + "01-senha-errada.png", fullPage: true });
    await ctx.close();
  }

  // 3. Login certo → /minha-conta com o nome vindo do trigger de signup.
  {
    const { ctx, page } = await fresh();
    await login(page, EMAIL, PW);
    check("login certo leva a /minha-conta", new URL(page.url()).pathname === "/minha-conta", page.url());
    const text = await page.textContent("body");
    check("…e mostra o nome do profile", text.includes("Olá, Usuário de Teste"));
    await page.waitForTimeout(1000);
    check("cabeçalho troca para 'Minha conta' quando logado", (await page.textContent("header")).includes("Minha conta"));
    await page.screenshot({ path: SHOTS + "02-minha-conta.png", fullPage: true });

    // 4. Já logado, /entrar e /cadastro não mostram formulário.
    await page.goto(`${BASE}/entrar`);
    check("logado, /entrar redireciona para a área do usuário", new URL(page.url()).pathname === "/minha-conta", page.url());
    await page.goto(`${BASE}/cadastro`);
    check("logado, /cadastro redireciona também", new URL(page.url()).pathname === "/minha-conta", page.url());

    // 5. Sair.
    await page.goto(`${BASE}/minha-conta`);
    await Promise.all([page.waitForURL((u) => u.pathname === "/"), page.click("text=Sair")]);
    check("sair leva para a home", new URL(page.url()).pathname === "/", page.url());
    await page.goto(`${BASE}/minha-conta`);
    check("depois de sair, /minha-conta volta a pedir login", new URL(page.url()).pathname === "/entrar", page.url());
    await ctx.close();
  }

  // 6. Redirecionamento aberto: ?next para outro domínio é ignorado.
  for (const evil of ["https://evil.example/phish", "//evil.example/phish", "/\\evil.example"]) {
    const { ctx, page } = await fresh();
    await login(page, EMAIL, PW, evil);
    const u = new URL(page.url());
    check(`?next=${evil} não sai do site`, u.host === new URL(BASE).host && u.pathname === "/minha-conta", page.url());
    await ctx.close();
  }

  // 7. ?next interno é respeitado.
  {
    const { ctx, page } = await fresh();
    await login(page, EMAIL, PW, "/imoveis?type=casa");
    const u = new URL(page.url());
    check("?next interno é respeitado", u.pathname === "/imoveis" && u.searchParams.get("type") === "casa", page.url());
    await ctx.close();
  }

  // 8. Validação do cadastro no servidor.
  {
    const { ctx, page } = await fresh();
    await page.goto(`${BASE}/cadastro`);
    await page.fill("#fullName", "Jo");
    await page.fill("#email", "nao-e-email");
    await page.fill("#password", "curta");
    await page.fill("#confirmPassword", "outra");
    await page.click("button[type=submit]");
    // Sem "networkidle": o iframe do Turnstile não deixa a rede parar.
    await page.waitForTimeout(300);
    await page.waitForFunction(() => !document.querySelector("button[type=submit][disabled]"));
    await page.waitForTimeout(500);
    const text = await page.textContent("body");
    check("cadastro: nome curto rejeitado", text.includes("Informe seu nome completo."));
    check("cadastro: e-mail inválido rejeitado", text.includes("Informe um e-mail válido."));
    check("cadastro: senha curta rejeitada", text.includes("pelo menos 8 caracteres"));
    check("cadastro: senhas diferentes rejeitadas", text.includes("As senhas não conferem."));
    check("cadastro: termos obrigatórios", text.includes("aceitar os termos"));
    check("cadastro: nome digitado preservado", (await page.inputValue("#fullName")) === "Jo");
    await page.screenshot({ path: SHOTS + "03-cadastro-validacao.png", fullPage: true });
    await ctx.close();
  }

  // 9. /auth/confirm: sem parâmetros e com token inválido.
  {
    const { ctx, page } = await fresh();
    await page.goto(`${BASE}/auth/confirm`);
    check("confirm sem parâmetros diz 'Link inválido'", (await page.textContent("body")).includes("Link inválido"));

    // Abrir o link NÃO pode consumir nada: só o botão verifica.
    await page.goto(`${BASE}/auth/confirm?token_hash=abc123falso&type=email&next=/minha-conta`);
    const before = await page.textContent("body");
    check("confirm com token mostra botão, sem verificar ao abrir", before.includes("Confirmar e-mail") && !before.includes("expirou"));
    await page.click("button[type=submit]");
    // Sem "networkidle": o iframe do Turnstile não deixa a rede parar.
    await page.waitForTimeout(300);
    await page.waitForFunction(() => !document.querySelector("button[type=submit][disabled]"));
    await page.waitForTimeout(500);
    check("token falso, ao clicar, dá 'expirou ou já foi usado'", (await page.textContent("body")).includes("expirou ou já foi usado"));
    await page.screenshot({ path: SHOTS + "04-confirm-token-falso.png", fullPage: true });

    await page.goto(`${BASE}/auth/confirm?token_hash=x&type=hackeado`);
    check("confirm com type fora da lista é inválido", (await page.textContent("body")).includes("Link inválido"));
    await ctx.close();
  }

  // 10. /auth/reset sem sessão de recuperação.
  {
    const { ctx, page } = await fresh();
    await page.goto(`${BASE}/auth/reset`);
    check("/auth/reset sem sessão vai para /esqueci-senha", new URL(page.url()).pathname === "/esqueci-senha", page.url());
    await ctx.close();
  }

  // 11. Esqueci a senha: resposta idêntica com ou sem conta.
  {
    const msgs = [];
    for (const e of [EMAIL, "ninguem.existe@imobi-test.invalid"]) {
      const { ctx, page } = await fresh();
      await page.goto(`${BASE}/esqueci-senha`);
      await page.fill("#email", e);
      await page.click("button[type=submit]");
      // Sem "networkidle": o iframe do Turnstile não deixa a rede parar.
      await page.waitForTimeout(300);
    await page.waitForFunction(() => !document.querySelector("button[type=submit][disabled]"));
      await page.waitForTimeout(500);
      msgs.push((await page.textContent("main")).trim());
      await ctx.close();
    }
    check("esqueci a senha: mesma resposta exista ou não a conta", msgs[0] === msgs[1] && msgs[0].includes("Se houver uma conta"), JSON.stringify(msgs));
  }
} finally {
  await browser.close();
}

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exitCode = fail ? 1 : 0;
