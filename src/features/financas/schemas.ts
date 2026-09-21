import { z } from "zod";
import { RULE_MATCH_FIELDS, RULE_MATCH_TYPES, type RuleMatchField, type RuleMatchType } from "./lib/match-rule";
import { CSV_COLUMN_ROLES, CSV_DATE_FORMATS, CSV_DECIMAL_SEPARATORS, CSV_DELIMITERS, type CsvColumnRole } from "./lib/parse-statement-csv";

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

// =========================================================
// LANÇAMENTOS (4.4)
// =========================================================

export const TRANSACTION_TYPES = ["expense", "income", "transfer"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  expense: "Despesa",
  income: "Receita",
  transfer: "Transferência",
};

/** Filtro "tipo" da página de lançamentos — `expense`/`income` são o `kind='normal'` do banco, separados pelo sinal de `amount_cents` (a tabela não tem coluna própria pra isso). */
export const TRANSACTION_TYPE_FILTERS = ["expense", "income", "transfer", "card_payment", "adjustment"] as const;
export type TransactionTypeFilter = (typeof TRANSACTION_TYPE_FILTERS)[number];

export const TRANSACTION_TYPE_FILTER_LABELS: Record<TransactionTypeFilter, string> = {
  expense: "Despesas",
  income: "Receitas",
  transfer: "Transferências",
  card_payment: "Pagamento de fatura",
  adjustment: "Ajuste",
};

export const TRANSACTION_STATUSES = ["pending", "cleared", "reconciled"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: "Pendente",
  cleared: "Efetivado",
  reconciled: "Conciliado",
};

/** "Repetir" (4.4) — presets simples derivados da data do lançamento, sem pedir dia da semana/mês de novo (ver `lib/build-recurring-from-transaction.ts`). */
export const TRANSACTION_REPEAT_OPTIONS = ["none", "weekly", "monthly", "yearly"] as const;
export type TransactionRepeatOption = (typeof TRANSACTION_REPEAT_OPTIONS)[number];

export const TRANSACTION_REPEAT_LABELS: Record<TransactionRepeatOption, string> = {
  none: "Não repetir",
  weekly: "Toda semana",
  monthly: "Todo mês",
  yearly: "Todo ano",
};

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(20).default([]);

export const createTransactionSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    amount: z.string().trim().min(1, "Digite o valor."),
    occurredOn: isoDateSchema,
    description: z.string().trim().min(1, "Digite uma descrição.").max(200),
    accountId: z.string().uuid().optional(),
    fromAccountId: z.string().uuid().optional(),
    toAccountId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    contactId: z.string().uuid().optional(),
    spaceId: z.string().uuid().optional(),
    tags: tagsSchema,
    notes: z.string().trim().max(2000).optional(),
    installments: z.coerce.number().int().min(1).max(60).default(1),
    repeat: z.enum(TRANSACTION_REPEAT_OPTIONS).default("none"),
  })
  .superRefine((data, ctx) => {
    if (data.type === "transfer") {
      if (!data.fromAccountId) ctx.addIssue({ code: "custom", path: ["fromAccountId"], message: "Escolha a conta de origem." });
      if (!data.toAccountId) ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Escolha a conta de destino." });
      if (data.fromAccountId && data.toAccountId && data.fromAccountId === data.toAccountId) {
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Escolha contas diferentes." });
      }
    } else {
      if (!data.accountId) ctx.addIssue({ code: "custom", path: ["accountId"], message: "Escolha uma conta." });
      if (data.installments > 1 && data.repeat !== "none") {
        ctx.addIssue({ code: "custom", path: ["repeat"], message: "Escolha parcelamento ou repetição, não as duas." });
      }
    }
  });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionDescriptionSchema = z.object({
  description: z.string().trim().min(1, "Digite uma descrição.").max(200),
});

export const updateTransactionCategorySchema = z.object({
  categoryId: z.string().uuid().nullable(),
});

export const bulkCategorizeSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um lançamento."),
  categoryId: z.string().uuid("Escolha uma categoria."),
});

export const quickExpenseSchema = z.object({
  accountId: z.string().uuid("Escolha uma conta."),
  amount: z.string().trim().min(1, "Digite o valor."),
  description: z.string().trim().min(1, "Digite uma descrição.").max(200),
  categoryId: z.string().uuid().optional(),
  occurredOn: isoDateSchema,
});

export type QuickExpenseInput = z.infer<typeof quickExpenseSchema>;

export const transactionFiltersSchema = z.object({
  periodStart: isoDateSchema,
  periodEnd: isoDateSchema,
  accountId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  type: z.enum(TRANSACTION_TYPE_FILTERS).optional(),
  status: z.enum(TRANSACTION_STATUSES).optional(),
  text: z.string().trim().max(200).optional(),
  noCategory: z.boolean().optional(),
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

export const DELETE_TRANSACTION_SCOPES = ["this", "future"] as const;
export type DeleteTransactionScope = (typeof DELETE_TRANSACTION_SCOPES)[number];

// =========================================================
// IMPORTAÇÃO DE EXTRATOS (4.5)
// =========================================================

export const IMPORT_FORMATS = ["ofx", "csv"] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

export const CSV_COLUMN_ROLE_LABELS: Record<CsvColumnRole, string> = {
  ignore: "Ignorar",
  date: "Data",
  description: "Descrição",
  amount: "Valor",
  debit: "Débito",
  credit: "Crédito",
};

export const CSV_DELIMITER_LABELS: Record<(typeof CSV_DELIMITERS)[number], string> = { ",": "Vírgula ( , )", ";": "Ponto e vírgula ( ; )" };
export const CSV_DECIMAL_LABELS: Record<(typeof CSV_DECIMAL_SEPARATORS)[number], string> = { ",": "Vírgula (1.234,56)", ".": "Ponto (1,234.56)" };

const csvImportMappingSchema = z.object({
  delimiter: z.enum(CSV_DELIMITERS),
  decimalSeparator: z.enum(CSV_DECIMAL_SEPARATORS),
  dateFormat: z.enum(CSV_DATE_FORMATS),
  headerRowsToSkip: z.coerce.number().int().min(0).max(20),
  columns: z.array(z.enum(CSV_COLUMN_ROLES)).min(1),
});

const isoDateOrNullSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .nullable();

const statementRowInputSchema = z.object({
  fitid: z.string().trim().min(1).nullable(),
  occurredOn: isoDateOrNullSchema,
  amountCents: z.number().int().nullable(),
  description: z.string(),
  error: z.string().nullable(),
});

export const previewImportSchema = z
  .object({
    accountId: z.string().uuid("Escolha uma conta."),
    format: z.enum(IMPORT_FORMATS),
    csvMapping: csvImportMappingSchema.optional(),
    rows: z.array(statementRowInputSchema).min(1, "O arquivo não tem nenhuma linha."),
  })
  .superRefine((data, ctx) => {
    if (data.format === "csv" && !data.csvMapping) {
      ctx.addIssue({ code: "custom", path: ["csvMapping"], message: "Mapeamento de colunas é obrigatório pra CSV." });
    }
  });

export type PreviewImportInput = z.infer<typeof previewImportSchema>;

const confirmImportRowSchema = z.object({
  fitid: z.string().trim().min(1).nullable(),
  occurredOn: isoDateSchema,
  amountCents: z.number().int().refine((v) => v !== 0, "Valor não pode ser zero."),
  description: z.string().trim().min(1, "Digite uma descrição.").max(200),
  hash: z.string().length(64),
  categoryId: z.string().uuid().optional(),
  linkBillId: z.string().uuid().optional(),
});

export const confirmImportSchema = z
  .object({
    accountId: z.string().uuid("Escolha uma conta."),
    format: z.enum(IMPORT_FORMATS),
    csvMapping: csvImportMappingSchema.optional(),
    rows: z.array(confirmImportRowSchema),
  })
  .superRefine((data, ctx) => {
    if (data.format === "csv" && !data.csvMapping) {
      ctx.addIssue({ code: "custom", path: ["csvMapping"], message: "Mapeamento de colunas é obrigatório pra CSV." });
    }
  });

export type ConfirmImportInput = z.infer<typeof confirmImportSchema>;

// =========================================================
// REGRAS DE CATEGORIZAÇÃO (4.6)
// =========================================================

export const RULE_MATCH_FIELD_LABELS: Record<RuleMatchField, string> = {
  description: "Descrição",
  original_description: "Descrição original (como veio do banco)",
};

export const RULE_MATCH_TYPE_LABELS: Record<RuleMatchType, string> = {
  contains: "Contém",
  starts_with: "Começa com",
  equals: "É igual a",
  regex: "Expressão regular",
};

export const ruleInputSchema = z
  .object({
    matchField: z.enum(RULE_MATCH_FIELDS).default("description"),
    matchType: z.enum(RULE_MATCH_TYPES).default("contains"),
    pattern: z.string().trim().min(1, "Digite o padrão."),
    accountId: z.string().uuid().optional(),
    amountMin: z.string().trim().optional(),
    amountMax: z.string().trim().optional(),
    setCategoryId: z.string().uuid().optional(),
    setContactId: z.string().uuid().optional(),
    setDescription: z.string().trim().max(200).optional(),
    setSpaceId: z.string().uuid().optional(),
    priority: z.coerce.number().int().min(1).max(1000).default(100),
  })
  .superRefine((data, ctx) => {
    if (data.matchType === "regex") {
      try {
        new RegExp(data.pattern);
      } catch {
        ctx.addIssue({ code: "custom", path: ["pattern"], message: "Expressão regular inválida." });
      }
    }
    if (!data.setCategoryId && !data.setContactId && !data.setDescription && !data.setSpaceId) {
      ctx.addIssue({ code: "custom", path: ["setCategoryId"], message: "A regra precisa definir ao menos categoria, contato, descrição ou espaço." });
    }
  });

export type RuleInput = z.infer<typeof ruleInputSchema>;

// =========================================================
// CARTÕES DE CRÉDITO E FATURAS (4.7)
// =========================================================

export const payStatementSchema = z.object({
  statementId: z.string().uuid(),
  paymentAccountId: z.string().uuid("Escolha a conta pagadora."),
  amount: z.string().trim().min(1, "Digite o valor."),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
});

export type PayStatementInput = z.infer<typeof payStatementSchema>;
