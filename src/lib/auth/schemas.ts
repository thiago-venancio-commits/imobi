import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Informe um e-mail válido." }));

/**
 * Senha: mínimo de 8 caracteres, com letra e número. Não exigimos símbolo nem
 * troca periódica — regra de composição mais rígida só empurra o usuário para
 * senhas previsíveis ("Senha@123"). O tamanho é o que importa.
 */
const password = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "A senha pode ter no máximo 72 caracteres.")
  .regex(/[A-Za-z]/, "Inclua pelo menos uma letra.")
  .regex(/[0-9]/, "Inclua pelo menos um número.");

/**
 * Confere "senha" e "confirme a senha" mesmo quando OUTROS campos falharam.
 *
 * No zod 4 o `.refine` de objeto é pulado se algum campo tiver erro. Sem o
 * `when`, quem erra o e-mail e a confirmação ao mesmo tempo só descobre a
 * segunda depois de corrigir a primeira, e precisa enviar o formulário duas
 * vezes. Aqui ele só exige que os dois campos de senha sejam texto.
 */
const passwordsMatch = {
  path: ["confirmPassword"],
  error: "As senhas não conferem.",
  when(payload: { value: unknown }) {
    const v = payload.value as { password?: unknown; confirmPassword?: unknown };
    return typeof v?.password === "string" && typeof v?.confirmPassword === "string";
  },
};

export const signInSchema = z.object({
  email,
  // No login não revalidamos a regra de composição: contas antigas ou criadas
  // por convite podem ter outra política, e a mensagem de erro não deve
  // revelar o que a senha "deveria" ser.
  password: z.string().min(1, "Informe a senha."),
});

export const signUpSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3, "Informe seu nome completo.")
      .max(120, "O nome está longo demais."),
    email,
    password,
    confirmPassword: z.string(),
    acceptTerms: z.literal("on", { error: "É preciso aceitar os termos para continuar." }),
  })
  .refine((v) => v.password === v.confirmPassword, passwordsMatch);

export const requestResetSchema = z.object({ email });

export const updatePasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, passwordsMatch);

/** Tipos de link de e-mail que o /auth/confirm aceita. */
export const otpTypeSchema = z.enum([
  "signup",
  "email",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
]);

export interface ActionState {
  /** Mensagem geral do formulário (erro ou aviso). */
  error?: string;
  /** Confirmação de sucesso que não redireciona (ex.: "verifique seu e-mail"). */
  message?: string;
  /** Erros por campo. */
  fieldErrors?: Record<string, string[] | undefined>;
  /** Valores a preservar no formulário depois de um erro. Nunca senhas. */
  values?: Record<string, string>;
}
