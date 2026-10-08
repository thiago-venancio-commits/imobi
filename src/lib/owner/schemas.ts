import { z } from "zod";

import { PROPERTY_TYPES, parseBRL } from "@/lib/properties";
import { UFS } from "@/lib/cep";

/**
 * Validação dos formulários do proprietário. Roda no servidor (Server
 * Actions); o banco valida de novo o que importa para a segurança (dono, status,
 * máscara anti-contato). Aqui o objetivo é a mensagem certa no campo certo.
 */

const digits = (v: string) => v.replace(/\D/g, "");

const phone = z
  .string()
  .transform(digits)
  .pipe(z.string().min(10, "Informe o telefone com DDD.").max(13, "Telefone inválido."));

const optionalPhone = z
  .string()
  .transform(digits)
  .pipe(z.union([z.literal(""), z.string().min(10, "Informe o WhatsApp com DDD.").max(13, "WhatsApp inválido.")]));

export const ownerApplicationSchema = z.object({
  fullName: z.string().trim().min(3, "Informe seu nome completo.").max(120, "O nome está longo demais."),
  phone,
  whatsapp: optionalPhone,
  cpfCnpj: z
    .string()
    .transform(digits)
    .refine((v) => v === "" || v.length === 11 || v.length === 14, "CPF tem 11 dígitos e CNPJ, 14."),
  declare: z.literal("on", { error: "Confirme que você é o proprietário ou responsável pelo imóvel." }),
});

const typeValues = PROPERTY_TYPES.map((t) => t.value) as [string, ...string[]];

export const newPropertySchema = z.object({
  type: z.enum(typeValues, { error: "Escolha o tipo do imóvel." }),
  purpose: z.enum(["venda", "locacao", "venda_locacao"], { error: "Escolha a finalidade." }),
  title: z.string().trim().min(5, "Dê um título com pelo menos 5 letras.").max(120, "Título longo demais."),
});

const count = z
  .string()
  .transform((v) => (v.trim() === "" ? 0 : Number(v)))
  .pipe(z.number().int("Use um número inteiro.").min(0, "Não pode ser negativo.").max(99, "Valor alto demais."));

const optionalArea = z
  .string()
  .transform((v) => (v.trim() === "" ? null : Number(v.replace(",", "."))))
  .pipe(z.number().positive("Use um número maior que zero.").max(10_000_000).nullable());

const optionalMoney = z
  .string()
  .transform(parseBRL)
  .pipe(z.number({ error: "Valor inválido." }).min(0, "Não pode ser negativo.").max(1_000_000_000).nullable());

/** Uma característica por linha (ou separadas por vírgula). */
const list = z
  .string()
  .transform((v) =>
    v
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().max(60, "Item longo demais.")).max(30, "No máximo 30 itens."));

export const propertyDetailsSchema = z.object({
  title: z.string().trim().min(5, "Dê um título com pelo menos 5 letras.").max(120, "Título longo demais."),
  description: z.string().trim().max(5000, "Descrição longa demais (máx. 5.000 caracteres)."),
  type: z.enum(typeValues, { error: "Escolha o tipo do imóvel." }),
  purpose: z.enum(["venda", "locacao", "venda_locacao"], { error: "Escolha a finalidade." }),
  condition: z.enum(["novo", "usado", "lancamento"], { error: "Escolha a condição." }),
  inCondominium: z.boolean(),
  bedrooms: count,
  suites: count,
  bathrooms: count,
  parkingSpaces: count,
  totalArea: optionalArea,
  builtArea: optionalArea,
  landArea: optionalArea,
  condoFee: optionalMoney,
  features: list,
  amenities: list,
});

export const propertyLocationSchema = z.object({
  cep: z.string().transform(digits).pipe(z.string().length(8, "CEP tem 8 dígitos.")),
  address: z.string().trim().min(3, "Informe a rua.").max(200),
  streetNumber: z.string().trim().min(1, "Informe o número (ou s/n).").max(20),
  complement: z.string().trim().max(100),
  neighborhood: z.string().trim().min(2, "Informe o bairro.").max(100),
  city: z.string().trim().min(2, "Informe a cidade.").max(100),
  state: z.enum(UFS, { error: "Escolha o estado." }),
  landmarks: z.string().trim().max(300, "Texto longo demais."),
});

export const propertyValuesSchema = z.object({
  priceSale: optionalMoney,
  priceRent: optionalMoney,
  minPrice: optionalMoney,
  downPayment: optionalMoney,
  commercialConditions: z.string().trim().max(2000, "Texto longo demais."),
  acceptsFinancing: z.boolean(),
  acceptsTrade: z.boolean(),
});

/** Nomes amigáveis do que submit_property diz que falta. */
export const MISSING_LABELS: Record<string, string> = {
  titulo: "título",
  cidade: "cidade e estado",
  bairro: "bairro",
  preco_venda: "valor de venda",
  preco_aluguel: "valor do aluguel",
  fotos: "pelo menos uma foto",
};
