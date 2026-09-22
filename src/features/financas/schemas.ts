import { z } from "zod";
import { RULE_MATCH_FIELDS, RULE_MATCH_TYPES, type RuleMatchField, type RuleMatchType } from "./lib/match-rule";
import { CSV_COLUMN_ROLES, CSV_DATE_FORMATS, CSV_DECIMAL_SEPARATORS, CSV_DELIMITERS, type CsvColumnRole } from "./lib/parse-statement-csv";
import { SPLIT_METHODS, type SplitMethod } from "./lib/split-shares";

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

/** Vazio = remove o orçamento (categoria volta a não ter limite) — 4.11. */
export const setCategoryBudgetSchema = z.object({
  monthlyBudget: z.string().trim().optional().or(z.literal("")),
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

// =========================================================
// CONTAS A PAGAR/RECEBER (4.8)
// =========================================================

export const BILL_DIRECTIONS = ["payable", "receivable"] as const;
export type BillDirection = (typeof BILL_DIRECTIONS)[number];

export const BILL_DIRECTION_LABELS: Record<BillDirection, string> = {
  payable: "A pagar",
  receivable: "A receber",
};

export const BILL_STATUSES = ["open", "partial", "paid", "canceled"] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  open: "Em aberto",
  partial: "Parcialmente paga",
  paid: "Paga",
  canceled: "Cancelada",
};

/** Abas de `/financas/contas` (4.8): "pagas" é só `status='paid'`; "a pagar"/"a receber" excluem pagas e canceladas; "todas" não filtra nada. */
export const BILL_TABS = ["payable", "receivable", "paid", "all"] as const;
export type BillTab = (typeof BILL_TABS)[number];

export const createBillSchema = z.object({
  direction: z.enum(BILL_DIRECTIONS),
  description: z.string().trim().min(1, "Digite uma descrição.").max(200),
  amount: z.string().trim().min(1, "Digite o valor."),
  /** Só usado quando `repeat !== "none"` — vira `fin_recurring.amount_is_estimate` ("conta de luz: valor varia"). Uma conta avulsa já tem valor exato, não precisa disso. */
  amountIsEstimate: z.boolean().default(false),
  dueOn: isoDateSchema,
  contactId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
  attachmentId: z.string().uuid().optional(),
  barcode: z.string().trim().max(200).optional(),
  pixCode: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
  repeat: z.enum(TRANSACTION_REPEAT_OPTIONS).default("none"),
});

export type CreateBillInput = z.infer<typeof createBillSchema>;

/** Edição (4.8): sem `repeat`/`amountIsEstimate` — recorrência é decidida só na criação; uma conta já existente tem valor exato. */
export const updateBillSchema = createBillSchema.omit({ repeat: true, amountIsEstimate: true });
export type UpdateBillInput = z.infer<typeof updateBillSchema>;

export const markBillPaidSchema = z.object({
  billId: z.string().uuid(),
  amount: z.string().trim().min(1, "Digite o valor."),
  paidOn: isoDateSchema,
  accountId: z.string().uuid("Escolha uma conta."),
});

export type MarkBillPaidInput = z.infer<typeof markBillPaidSchema>;

export const billFiltersSchema = z.object({
  tab: z.enum(BILL_TABS).default("all"),
  spaceId: z.string().uuid().optional(),
});

export type BillFilters = z.infer<typeof billFiltersSchema>;

/** "Extrair dados de boleto com IA" (4.8) — formato que a IA devolve; o dono revisa antes de salvar, nunca preenche sozinho. */
export const billExtractionSchema = z.object({
  amountCents: z.number().int().positive().nullable(),
  dueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  payeeName: z.string().trim().min(1).nullable(),
  barcode: z.string().trim().min(1).nullable(),
});

export type BillExtraction = z.infer<typeof billExtractionSchema>;

// =========================================================
// RECORRÊNCIAS (4.8)
// =========================================================

/** Frequência de uma recorrência avulsa (`/financas/recorrencias`) — mesmo conjunto de `TRANSACTION_REPEAT_OPTIONS` sem "none" (uma recorrência sempre repete). */
export const RECURRING_REPEAT_OPTIONS = ["weekly", "monthly", "yearly"] as const;
export type RecurringRepeatOption = (typeof RECURRING_REPEAT_OPTIONS)[number];

export const createRecurringSchema = z.object({
  direction: z.enum(BILL_DIRECTIONS),
  description: z.string().trim().min(1, "Digite uma descrição.").max(200),
  amount: z.string().trim().min(1, "Digite o valor."),
  amountIsEstimate: z.boolean().default(false),
  repeat: z.enum(RECURRING_REPEAT_OPTIONS),
  /** Data da primeira ocorrência futura — vira `next_due_on` direto (ao contrário do "repetir" da 4.4/4.8, aqui não existe uma primeira conta já criada pra pular). */
  anchorDate: isoDateSchema,
  contactId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
  endsOn: isoDateSchema.optional(),
  remindDaysBefore: z.coerce.number().int().min(0).max(30).default(3),
});

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;

/** Edição (4.8): não muda a frequência/âncora (RRULE) — pra outra cadência, desativa esta e cria outra. */
export const updateRecurringSchema = createRecurringSchema.omit({ direction: true, repeat: true, anchorDate: true });
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;

// =========================================================
// DIVISÃO DE CONTAS (4.9)
// =========================================================

export const SPLIT_METHOD_LABELS: Record<SplitMethod, string> = {
  equal: "Igual",
  exact: "Valores exatos",
  percent: "Porcentagem",
  shares: "Cotas",
};

export const SPLIT_STATUSES = ["open", "settled", "canceled"] as const;
export type SplitStatus = (typeof SPLIT_STATUSES)[number];

export const SPLIT_STATUS_LABELS: Record<SplitStatus, string> = {
  open: "Em aberto",
  settled: "Quitada",
  canceled: "Cancelada",
};

/** Origem da transação do total (4.9) — só faz sentido quando eu paguei (`paidByContactId` vazio): se um contato pagou, não há lançamento meu do total pra criar/vincular. */
export const SPLIT_ORIGIN_MODES = ["none", "create", "link"] as const;
export type SplitOriginMode = (typeof SPLIT_ORIGIN_MODES)[number];

const splitParticipantSchema = z.object({
  /** `null` = eu. */
  contactId: z.string().uuid().nullable(),
  /** Método `exact` — valor em texto (`parseBRL`). */
  value: z.string().trim().optional(),
  /** Métodos `percent`/`shares` — peso numérico. */
  weight: z.coerce.number().positive().optional(),
});

export type SplitParticipantFormInput = z.infer<typeof splitParticipantSchema>;

export const createSplitSchema = z
  .object({
    title: z.string().trim().min(1, "Digite um título.").max(200),
    totalAmount: z.string().trim().min(1, "Digite o valor total."),
    occurredOn: isoDateSchema,
    /** Vazio = eu paguei. */
    paidByContactId: z.string().uuid().optional(),
    method: z.enum(SPLIT_METHODS),
    participants: z.array(splitParticipantSchema).min(1, "Escolha ao menos um participante."),
    originMode: z.enum(SPLIT_ORIGIN_MODES).default("none"),
    linkTransactionId: z.string().uuid().optional(),
    createAccountId: z.string().uuid().optional(),
    createCategoryId: z.string().uuid().optional(),
    attachmentId: z.string().uuid().optional(),
    groupLabel: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.originMode !== "none" && data.paidByContactId) {
      ctx.addIssue({ code: "custom", path: ["originMode"], message: "Só é possível criar ou vincular um lançamento quando eu paguei." });
    }
    if (data.originMode === "link" && !data.linkTransactionId) {
      ctx.addIssue({ code: "custom", path: ["linkTransactionId"], message: "Escolha um lançamento." });
    }
    if (data.originMode === "create" && !data.createAccountId) {
      ctx.addIssue({ code: "custom", path: ["createAccountId"], message: "Escolha uma conta." });
    }
    const contactIds = data.participants.map((p) => p.contactId ?? "__eu__");
    if (new Set(contactIds).size !== contactIds.length) {
      ctx.addIssue({ code: "custom", path: ["participants"], message: "Cada participante só pode aparecer uma vez." });
    }
  });

export type CreateSplitInput = z.infer<typeof createSplitSchema>;

export const registerSplitPaymentSchema = z.object({
  shareId: z.string().uuid(),
  amount: z.string().trim().min(1, "Digite o valor."),
  occurredOn: isoDateSchema,
  accountId: z.string().uuid("Escolha uma conta."),
});

export type RegisterSplitPaymentInput = z.infer<typeof registerSplitPaymentSchema>;
