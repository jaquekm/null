import { z } from "zod";

export const ACCOUNT_KINDS = ["checking", "savings", "credit_card", "cash", "investment", "wallet", "other"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit_card: "Cartão de crédito",
  cash: "Dinheiro",
  investment: "Investimento",
  wallet: "Carteira digital",
  other: "Outro",
};

/** Campos de cartão (`creditLimit`/`closingDay`/`dueDay`/`paymentAccountId`) ficam opcionais mesmo em `kind: "credit_card"` — o dono pode completar depois. */
export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Digite um nome.").max(120),
  kind: z.enum(ACCOUNT_KINDS),
  institution: z.string().trim().max(120).optional(),
  spaceId: z.string().uuid().optional(),
  openingBalance: z.string().trim().min(1, "Digite o saldo inicial."),
  openingDate: z.string().min(1, "Escolha a data."),
  creditLimit: z.string().trim().optional(),
  closingDay: z.coerce.number().int().min(1).max(31).optional(),
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
  paymentAccountId: z.string().uuid().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const PIX_KEY_TYPES = ["cpf", "cnpj", "email", "phone", "random"] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

export const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Telefone",
  random: "Chave aleatória",
};

export const createPixKeySchema = z.object({
  label: z.string().trim().min(1, "Digite um rótulo.").max(120),
  keyType: z.enum(PIX_KEY_TYPES),
  keyValue: z.string().trim().min(1, "Digite a chave.").max(140),
  merchantName: z
    .string()
    .trim()
    .min(1, "Digite o nome do recebedor.")
    .max(25, "Até 25 caracteres — limite do padrão Pix."),
  merchantCity: z
    .string()
    .trim()
    .min(1, "Digite a cidade.")
    .max(15, "Até 15 caracteres — limite do padrão Pix."),
  spaceId: z.string().uuid().optional(),
  isDefault: z.boolean().default(false),
});

export type CreatePixKeyInput = z.infer<typeof createPixKeySchema>;

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Digite um nome.").max(120),
  kind: z.enum(["income", "expense"]),
  parentId: z.string().uuid().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const renameCategorySchema = z.object({
  name: z.string().trim().min(1, "Digite um nome.").max(120),
});
