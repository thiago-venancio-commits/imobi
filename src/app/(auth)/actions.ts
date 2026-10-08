"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { appUrl } from "@/lib/env";
import { safeNext } from "@/lib/auth/safe-redirect";
import {
  type ActionState,
  otpTypeSchema,
  requestResetSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/auth/schemas";
import { homeFor } from "@/lib/server/page-guards";
import { getCaller } from "@/lib/server/caller";
import { createClient } from "@/lib/supabase/server";

/**
 * Ações de autenticação.
 *
 * Todas rodam no servidor e devolvem `ActionState` para o formulário. Nada aqui
 * confia em dado do cliente além do que o próprio usuário digitou: quem está
 * logado vem do cookie de sessão, e a que papel ele pertence vem do banco.
 */

type Supa = Awaited<ReturnType<typeof createClient>>;

/**
 * Página inicial do usuário que acabou de entrar, lida com o MESMO cliente que
 * fez o login. Criar outro cliente (getCaller) dependeria de o cookie recém
 * gravado já estar visível na mesma requisição, e um valor velho mandaria todo
 * mundo para a área errada.
 */
async function homeAfterAuth(supabase: Supa): Promise<string> {
  const { data } = await supabase.rpc("my_roles");
  const r = data?.[0];
  return homeFor({
    isMaster: r?.is_master === true,
    isBroker: r?.is_broker === true,
    isOwner: r?.is_owner === true,
    ownerStatus: r?.owner_status ?? null,
  });
}

function fieldErrors(error: z.ZodError): ActionState["fieldErrors"] {
  return z.flattenError(error).fieldErrors;
}

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/**
 * Token do Turnstile (components/auth/turnstile.tsx). Vai para o Supabase, que
 * valida no servidor dele quando o captcha está ligado no projeto; com o
 * captcha desligado o Supabase simplesmente ignora.
 */
function captchaToken(formData: FormData): string | undefined {
  return field(formData, "cf-turnstile-response") || undefined;
}

const CAPTCHA_ERROR =
  "Não conseguimos confirmar que você não é um robô. Aguarde a verificação abaixo e tente de novo.";

// ---------------------------------------------------------------------------
// Entrar
// ---------------------------------------------------------------------------
export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: field(formData, "email"),
    password: field(formData, "password"),
  });
  const values = { email: field(formData, "email") };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    ...parsed.data,
    options: { captchaToken: captchaToken(formData) },
  });

  if (error) {
    if (error.code === "captcha_failed") return { error: CAPTCHA_ERROR, values };
    // E-mail não confirmado é o único caso em que explicamos: quem digitou a
    // senha certa precisa saber o que fazer. Os demais ficam genéricos, para
    // não confirmar quais e-mails têm conta.
    if (error.code === "email_not_confirmed") {
      return {
        error: "Seu e-mail ainda não foi confirmado. Abra a mensagem que enviamos e clique no link.",
        values,
      };
    }
    return { error: "E-mail ou senha incorretos.", values };
  }

  // Usuário bloqueado pelo Master perde o acesso na hora, sem esperar a
  // sessão expirar.
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userData.user?.id ?? "")
    .maybeSingle();

  if (profile?.status === "bloqueado") {
    await supabase.auth.signOut();
    return { error: "Esta conta está bloqueada. Entre em contato com a nossa equipe.", values };
  }

  const requested = formData.get("next");
  redirect(safeNext(typeof requested === "string" ? requested : null, await homeAfterAuth(supabase)));
}

// ---------------------------------------------------------------------------
// Cadastrar
// ---------------------------------------------------------------------------
export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    fullName: field(formData, "fullName"),
    email: field(formData, "email"),
  };
  const parsed = signUpSchema.safeParse({
    fullName: field(formData, "fullName"),
    email: field(formData, "email"),
    password: field(formData, "password"),
    confirmPassword: field(formData, "confirmPassword"),
    acceptTerms: formData.get("acceptTerms") ?? undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // O trigger de signup copia isto para profiles.full_name.
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: appUrl("/auth/confirm?next=/minha-conta"),
      captchaToken: captchaToken(formData),
    },
  });

  if (error) {
    if (error.code === "captcha_failed") return { error: CAPTCHA_ERROR, values };
    if (error.code === "weak_password") {
      return { fieldErrors: { password: ["Essa senha é fraca ou muito comum. Escolha outra."] }, values };
    }
    // Não distinguimos "já existe" de erro genérico, pelo mesmo motivo do login.
    return { error: "Não foi possível criar a conta agora. Tente novamente em instantes.", values };
  }

  // Com confirmação de e-mail ligada não há sessão ainda. A mensagem é a mesma
  // exista ou não uma conta com esse e-mail (o Supabase devolve um usuário
  // "falso" para e-mails já cadastrados), então o formulário não serve para
  // descobrir quem é cliente.
  if (!data.session) {
    return {
      message:
        "Enviamos um link de confirmação para o seu e-mail. Abra a mensagem e clique no link para ativar a conta.",
    };
  }

  redirect("/minha-conta");
}

// ---------------------------------------------------------------------------
// Esqueci a senha
// ---------------------------------------------------------------------------
export async function requestResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = requestResetSchema.safeParse({ email: field(formData, "email") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), values: { email: field(formData, "email") } };
  }

  const supabase = await createClient();
  // O resultado é ignorado de propósito — sempre respondemos o mesmo texto, com
  // ou sem conta, para o formulário não revelar quais e-mails existem. A única
  // exceção é o captcha: ele não diz nada sobre a conta, e sem avisar o
  // usuário ficaria esperando um e-mail que nunca foi enviado.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: appUrl("/auth/confirm?next=/auth/reset"),
    captchaToken: captchaToken(formData),
  });
  if (error?.code === "captcha_failed") {
    return { error: CAPTCHA_ERROR, values: { email: parsed.data.email } };
  }

  return {
    message:
      "Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. Confira também a caixa de spam.",
  };
}

// ---------------------------------------------------------------------------
// Nova senha (depois de clicar no link do e-mail)
// ---------------------------------------------------------------------------
export async function updatePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = updatePasswordSchema.safeParse({
    password: field(formData, "password"),
    confirmPassword: field(formData, "confirmPassword"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  // Só quem chegou pelo link de recuperação tem sessão aqui. Sem ela,
  // updateUser falharia, mas conferimos antes para dar uma mensagem útil.
  const caller = await getCaller();
  if (!caller) {
    return { error: "O link expirou. Peça um novo em “Esqueci minha senha”." };
  }

  const { error } = await caller.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { fieldErrors: { password: ["A nova senha precisa ser diferente da atual."] } };
    }
    if (error.code === "weak_password") {
      return { fieldErrors: { password: ["Essa senha é fraca ou muito comum. Escolha outra."] } };
    }
    return { error: "Não foi possível trocar a senha. Peça um novo link e tente de novo." };
  }

  // Quem trocou a senha provavelmente suspeitava de acesso indevido: derruba as
  // outras sessões e mantém só esta.
  await caller.supabase.auth.signOut({ scope: "others" });

  redirect(homeFor(caller));
}

// ---------------------------------------------------------------------------
// Confirmar link do e-mail (cadastro e recuperação de senha)
//
// É uma ação disparada por botão, e não um GET que verifica ao abrir. Antivírus
// e "links seguros" de e-mail corporativo (Outlook, Defender) abrem todo link
// da mensagem antes do usuário; o token é de uso único, então um GET que o
// consome faria o link chegar "expirado" a quem de fato clica.
// ---------------------------------------------------------------------------
export async function verifyEmailLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const code = field(formData, "code");

  if (code) {
    // Fluxo PKCE: o e-mail padrão do Supabase passa pelo verificador dele e
    // volta aqui com ?code=. A troca exige o cookie gravado quando o pedido foi
    // feito, então só funciona no mesmo navegador. Com os templates próprios
    // (token_hash, abaixo) o link abre em qualquer aparelho; isso exige SMTP
    // próprio no Supabase, e vale como alternativa até lá e para login social.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return {
        error:
          "Este link expirou, já foi usado ou foi aberto em outro navegador. Peça um novo e abra no mesmo aparelho.",
      };
    }
    redirect(safeNext(field(formData, "next"), await homeAfterAuth(supabase)));
  }

  const type = otpTypeSchema.safeParse(field(formData, "type"));
  const tokenHash = field(formData, "token_hash");
  if (!type.success || !tokenHash) {
    return { error: "Este link é inválido. Peça um novo e tente de novo." };
  }

  const { error } = await supabase.auth.verifyOtp({ type: type.data, token_hash: tokenHash });
  if (error) {
    return { error: "Este link expirou ou já foi usado. Peça um novo e tente de novo." };
  }

  // Recuperação de senha sempre termina na tela de nova senha, qualquer que
  // seja o `next` que veio na URL.
  if (type.data === "recovery") redirect("/auth/reset");

  redirect(safeNext(field(formData, "next"), await homeAfterAuth(supabase)));
}

// ---------------------------------------------------------------------------
// Sair
// ---------------------------------------------------------------------------
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
