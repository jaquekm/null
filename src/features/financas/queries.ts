import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { BillForMatching } from "./lib/match-bills";
import type { CategorizationRule, TransactionForRuleMatch } from "./lib/match-rule";
import type { CsvImportMapping } from "./lib/parse-statement-csv";
import type { SplitMethod } from "./lib/split-shares";
import type { RecentTransactionForSuggestion } from "./lib/suggest-category";
import type { AccountKind, BillDirection, BillFilters, BillStatus, ImportFormat, PixKeyType, SplitStatus, TransactionFilters, TransactionStatus } from "./schemas";

type Client = SupabaseClient<Database>;

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** Mesma duplicação já usada em `agenda`/`reminders` (sem helper central de datas no projeto). */
export async function getUserTimezone(supabase: Client, ownerId: string): Promise<string> {
  const { data } = await supabase.from("user_settings").select("timezone").eq("owner_id", ownerId).maybeSingle();
  return data?.timezone ?? DEFAULT_TIMEZONE;
}

export interface AccountRow {
  id: string;
  name: string;
  kind: AccountKind;
  institution: string | null;
  spaceId: string | null;
  openingBalanceCents: number;
  openingDate: string;
  creditLimitCents: number | null;
  closingDay: number | null;
  dueDay: number | null;
  paymentAccountId: string | null;
}

const ACCOUNT_COLUMNS =
  "id, name, kind, institution, space_id, opening_balance_cents, opening_date, credit_limit_cents, closing_day, due_day, payment_account_id";

function mapAccountRow(row: Record<string, unknown>): AccountRow {
  return {
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as AccountKind,
    institution: row.institution as string | null,
    spaceId: row.space_id as string | null,
    openingBalanceCents: row.opening_balance_cents as number,
    openingDate: row.opening_date as string,
    creditLimitCents: row.credit_limit_cents as number | null,
    closingDay: row.closing_day as number | null,
    dueDay: row.due_day as number | null,
    paymentAccountId: row.payment_account_id as string | null,
  };
}

/** Contas ainda ativas do dono (onboarding financeiro, 4.3). */
export async function listAccounts(supabase: Client): Promise<AccountRow[]> {
  const { data, error } = await supabase.from("fin_accounts").select(ACCOUNT_COLUMNS).is("archived_at", null).order("position", { ascending: true });
  if (error) throw error;
  return data.map(mapAccountRow);
}

export interface CategoryRow {
  id: string;
  parentId: string | null;
  name: string;
  kind: "income" | "expense";
}

/** Categorias ativas do dono, pra revisar no onboarding (4.3) e usar em regras/lançamentos depois. */
export async function listCategories(supabase: Client): Promise<CategoryRow[]> {
  const { data, error } = await supabase.from("fin_categories").select("id, parent_id, name, kind").is("archived_at", null).order("name", { ascending: true });
  if (error) throw error;
  return data.map((row) => ({ id: row.id, parentId: row.parent_id, name: row.name, kind: row.kind as "income" | "expense" }));
}

export interface PixKeyRow {
  id: string;
  label: string;
  keyType: PixKeyType;
  keyValue: string;
  merchantName: string;
  merchantCity: string;
  spaceId: string | null;
  isDefault: boolean;
}

/** Chaves Pix cadastradas (4.3 — opcional; usadas de verdade na página pública de cobrança, 4.10). */
export async function listPixKeys(supabase: Client): Promise<PixKeyRow[]> {
  const { data, error } = await supabase
    .from("fin_pix_keys")
    .select("id, label, key_type, key_value, merchant_name, merchant_city, space_id, is_default")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    label: row.label,
    keyType: row.key_type as PixKeyType,
    keyValue: row.key_value,
    merchantName: row.merchant_name,
    merchantCity: row.merchant_city,
    spaceId: row.space_id,
    isDefault: row.is_default,
  }));
}

/** "Enviar dados financeiros pra IA" (4.3, passo 4) — padrão desligado, só liga se o dono marcar explicitamente. */
export async function isFinanceAiEnabled(supabase: Client, ownerId: string): Promise<boolean> {
  const { data } = await supabase.from("user_settings").select("preferences").eq("owner_id", ownerId).maybeSingle();
  const preferences = (data?.preferences as Record<string, unknown> | null) ?? {};
  return preferences.financeAiEnabled === true;
}

/** Marca (ou não) que o onboarding financeiro já rodou — evita redirecionar pra `/financas/configurar` de novo. */
export async function isFinanceOnboardingCompleted(supabase: Client, ownerId: string): Promise<boolean> {
  const { data } = await supabase.from("user_settings").select("preferences").eq("owner_id", ownerId).maybeSingle();
  const preferences = (data?.preferences as Record<string, unknown> | null) ?? {};
  return Boolean(preferences.financeOnboardingCompletedAt);
}

// =========================================================
// LANÇAMENTOS (4.4)
// =========================================================

export interface TransactionRow {
  id: string;
  occurredOn: string;
  description: string;
  amountCents: number;
  status: TransactionStatus;
  kind: string;
  accountId: string;
  categoryId: string | null;
  contactId: string | null;
  spaceId: string | null;
  tags: string[];
  notes: string | null;
  transferGroupId: string | null;
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  /** Não nulo quando o lançamento veio de uma importação (4.5) — usado pra oferecer "aprender com correções" (4.6) ao trocar a categoria. */
  importId: string | null;
}

const TRANSACTION_COLUMNS =
  "id, occurred_on, description, amount_cents, status, kind, account_id, category_id, contact_id, space_id, tags, notes, transfer_group_id, installment_group_id, installment_number, installment_total, import_id";

function mapTransactionRow(row: Record<string, unknown>): TransactionRow {
  return {
    id: row.id as string,
    occurredOn: row.occurred_on as string,
    description: row.description as string,
    amountCents: row.amount_cents as number,
    status: row.status as TransactionStatus,
    kind: row.kind as string,
    accountId: row.account_id as string,
    categoryId: row.category_id as string | null,
    contactId: row.contact_id as string | null,
    spaceId: row.space_id as string | null,
    tags: (row.tags as string[] | null) ?? [],
    notes: row.notes as string | null,
    transferGroupId: row.transfer_group_id as string | null,
    installmentGroupId: row.installment_group_id as string | null,
    installmentNumber: row.installment_number as number | null,
    installmentTotal: row.installment_total as number | null,
    importId: row.import_id as string | null,
  };
}

/**
 * Lançamentos do período + filtros (4.4). Sem paginação (mesmo padrão de
 * `listContacts`/`listAccounts`: lista inteira, filtrada no servidor) — o
 * filtro de período já limita o tamanho normal do resultado a um mês;
 * `limit(2000)` é só uma proteção contra um mês fora do comum, não uma UI de
 * paginação de verdade.
 */
export async function listTransactions(supabase: Client, filters: TransactionFilters): Promise<TransactionRow[]> {
  let query = supabase.from("fin_transactions").select(TRANSACTION_COLUMNS).gte("occurred_on", filters.periodStart).lte("occurred_on", filters.periodEnd);

  if (filters.accountId) query = query.eq("account_id", filters.accountId);
  if (filters.spaceId) query = query.eq("space_id", filters.spaceId);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.contactId) query = query.eq("contact_id", filters.contactId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.noCategory) query = query.is("category_id", null);
  if (filters.text?.trim()) {
    // mesmo cuidado de `listContacts`: `,()` têm significado especial no `.ilike`/`.or()` do PostgREST.
    const term = filters.text.trim().replace(/[,()%]/g, "");
    if (term) query = query.ilike("description", `%${term}%`);
  }
  if (filters.type === "expense") query = query.eq("kind", "normal").lt("amount_cents", 0);
  else if (filters.type === "income") query = query.eq("kind", "normal").gt("amount_cents", 0);
  else if (filters.type) query = query.eq("kind", filters.type);

  const { data, error } = await query.order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(2000);
  if (error) throw error;
  return data.map(mapTransactionRow);
}

/** Últimos lançamentos categorizados, pra sugerir categoria no "Gasto rápido" (`suggestCategoryId`, `lib/suggest-category.ts`). */
export async function listRecentCategorizedTransactions(supabase: Client, limit = 200): Promise<RecentTransactionForSuggestion[]> {
  const { data, error } = await supabase
    .from("fin_transactions")
    .select("description, category_id, occurred_on")
    .not("category_id", "is", null)
    .order("occurred_on", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((row) => ({ description: row.description, categoryId: row.category_id as string, occurredOn: row.occurred_on }));
}

// =========================================================
// IMPORTAÇÃO DE EXTRATOS (4.5)
// =========================================================

/** Contas a pagar/receber ainda abertas (ou parcialmente pagas), pra sugerir vínculo na importação (`matchBills`, `lib/match-bills.ts`). */
export async function listOpenBillsForMatching(supabase: Client): Promise<BillForMatching[]> {
  const { data, error } = await supabase.from("fin_bills").select("id, direction, amount_cents, paid_cents, due_on, description").in("status", ["open", "partial"]);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    direction: row.direction as "payable" | "receivable",
    remainingCents: row.amount_cents - row.paid_cents,
    dueOn: row.due_on,
    description: row.description,
  }));
}

/** Último mapeamento de colunas usado numa importação CSV desta conta — "salvar o mapeamento na conta para próximas importações" (4.5), sem precisar de coluna nova em `fin_accounts`. */
export async function getLastCsvMapping(supabase: Client, accountId: string): Promise<CsvImportMapping | null> {
  const { data } = await supabase
    .from("fin_imports")
    .select("csv_mapping")
    .eq("account_id", accountId)
    .eq("format", "csv")
    .not("csv_mapping", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.csv_mapping as unknown as CsvImportMapping | null) ?? null;
}

/** Hashes já usados nesta conta, dentre os informados — pra marcar "Duplicado" na pré-visualização (4.5). */
export async function listExistingImportHashes(supabase: Client, accountId: string, hashes: string[]): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();
  const { data, error } = await supabase.from("fin_transactions").select("import_hash").eq("account_id", accountId).in("import_hash", hashes);
  if (error) throw error;
  return new Set(data.map((row) => row.import_hash).filter((hash): hash is string => hash != null));
}

export interface ImportSummaryRow {
  id: string;
  accountId: string;
  format: ImportFormat;
  status: "preview" | "imported" | "undone";
  rowsTotal: number;
  rowsImported: number;
  rowsDuplicate: number;
  rowsError: number;
  createdAt: string;
}

/** Importações recentes (qualquer conta), pra listar em `/financas/importar` com opção de desfazer (4.5). */
export async function listRecentImports(supabase: Client, limit = 15): Promise<ImportSummaryRow[]> {
  const { data, error } = await supabase
    .from("fin_imports")
    .select("id, account_id, format, status, rows_total, rows_imported, rows_duplicate, rows_error, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    format: row.format as ImportFormat,
    status: row.status as "preview" | "imported" | "undone",
    rowsTotal: row.rows_total,
    rowsImported: row.rows_imported,
    rowsDuplicate: row.rows_duplicate,
    rowsError: row.rows_error,
    createdAt: row.created_at,
  }));
}

// =========================================================
// REGRAS DE CATEGORIZAÇÃO (4.6)
// =========================================================

export interface RuleRow extends CategorizationRule {
  timesApplied: number;
}

const RULE_COLUMNS =
  "id, match_field, match_type, pattern, account_id, amount_min_cents, amount_max_cents, set_category_id, set_contact_id, set_description, set_space_id, priority, times_applied";

function mapRuleRow(row: Record<string, unknown>): RuleRow {
  return {
    id: row.id as string,
    matchField: row.match_field as CategorizationRule["matchField"],
    matchType: row.match_type as CategorizationRule["matchType"],
    pattern: row.pattern as string,
    accountId: row.account_id as string | null,
    amountMinCents: row.amount_min_cents as number | null,
    amountMaxCents: row.amount_max_cents as number | null,
    setCategoryId: row.set_category_id as string | null,
    setContactId: row.set_contact_id as string | null,
    setDescription: row.set_description as string | null,
    setSpaceId: row.set_space_id as string | null,
    priority: row.priority as number,
    timesApplied: row.times_applied as number,
  };
}

/** Todas as regras do dono, por prioridade — mesmo formato (`CategorizationRule`) usado por `matchRule` (lib/match-rule.ts), pra não duplicar mapeamento entre a UI e a aplicação automática. */
export async function listRules(supabase: Client): Promise<RuleRow[]> {
  const { data, error } = await supabase.from("fin_rules").select(RULE_COLUMNS).order("priority", { ascending: true });
  if (error) throw error;
  return data.map(mapRuleRow);
}

/** Lançamentos dos últimos `days` dias, pro "Testar nos últimos 90 dias" (4.6) — só os campos que `ruleMatchesTransaction` usa. */
export async function listTransactionsForRuleTest(supabase: Client, sinceDate: string): Promise<TransactionForRuleMatch[]> {
  const { data, error } = await supabase.from("fin_transactions").select("description, original_description, account_id, amount_cents").gte("occurred_on", sinceDate);
  if (error) throw error;
  return data.map((row) => ({ description: row.description, originalDescription: row.original_description, accountId: row.account_id, amountCents: row.amount_cents }));
}

// =========================================================
// CARTÕES DE CRÉDITO E FATURAS (4.7)
// =========================================================

export interface CardStatementRow {
  id: string;
  accountId: string;
  referenceMonth: string;
  periodStart: string;
  periodEnd: string;
  dueOn: string;
  status: "open" | "closed" | "paid" | "partial";
  paidCents: number;
}

const CARD_STATEMENT_COLUMNS = "id, account_id, reference_month, period_start, period_end, due_on, status, paid_cents";

function mapCardStatementRow(row: Record<string, unknown>): CardStatementRow {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    referenceMonth: row.reference_month as string,
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    dueOn: row.due_on as string,
    status: row.status as CardStatementRow["status"],
    paidCents: row.paid_cents as number,
  };
}

/** Faturas de um cartão, mais recente primeiro — página do cartão (4.7). */
export async function listCardStatements(supabase: Client, accountId: string): Promise<CardStatementRow[]> {
  const { data, error } = await supabase.from("fin_card_statements").select(CARD_STATEMENT_COLUMNS).eq("account_id", accountId).order("reference_month", { ascending: false });
  if (error) throw error;
  return data.map(mapCardStatementRow);
}

export async function getCardStatement(supabase: Client, statementId: string): Promise<CardStatementRow | null> {
  const { data, error } = await supabase.from("fin_card_statements").select(CARD_STATEMENT_COLUMNS).eq("id", statementId).maybeSingle();
  if (error) throw error;
  return data ? mapCardStatementRow(data) : null;
}

/** Faturas já existentes pra um conjunto de `reference_month` desta conta — o find-or-create de fatura (4.7) só cria as que faltarem. */
export async function listCardStatementsByReferenceMonths(supabase: Client, accountId: string, referenceMonths: string[]): Promise<CardStatementRow[]> {
  if (referenceMonths.length === 0) return [];
  const { data, error } = await supabase.from("fin_card_statements").select(CARD_STATEMENT_COLUMNS).eq("account_id", accountId).in("reference_month", referenceMonths);
  if (error) throw error;
  return data.map(mapCardStatementRow);
}

/** Lançamentos de uma fatura específica — mesmo formato de `listTransactions` (4.4). */
export async function listStatementTransactions(supabase: Client, statementId: string): Promise<TransactionRow[]> {
  const { data, error } = await supabase.from("fin_transactions").select(TRANSACTION_COLUMNS).eq("statement_id", statementId).order("occurred_on", { ascending: true });
  if (error) throw error;
  return data.map(mapTransactionRow);
}

/** Soma assinada das transações de uma fatura — o total devido é o valor absoluto dela (4.7). */
export async function sumStatementTransactionAmounts(supabase: Client, statementId: string): Promise<number> {
  const { data, error } = await supabase.from("fin_transactions").select("amount_cents").eq("statement_id", statementId);
  if (error) throw error;
  return data.reduce((sum, row) => sum + row.amount_cents, 0);
}

/** Soma assinada por fatura, pra listar os totais de todas as faturas de um cartão numa única consulta (página do cartão, 4.7). */
export async function listCardStatementTotals(supabase: Client, accountId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.from("fin_transactions").select("statement_id, amount_cents").eq("account_id", accountId).not("statement_id", "is", null);
  if (error) throw error;
  const totals = new Map<string, number>();
  for (const row of data) {
    if (!row.statement_id) continue;
    totals.set(row.statement_id, (totals.get(row.statement_id) ?? 0) + row.amount_cents);
  }
  return totals;
}

/** Saldo da conta (`fin_account_balances`, 4.2) — pra cartão, negativo é o quanto está devendo; "limite usado" é o valor absoluto disso (4.7). */
export async function getAccountBalanceCents(supabase: Client, accountId: string): Promise<number> {
  const { data, error } = await supabase.from("fin_account_balances").select("balance_cents").eq("account_id", accountId).maybeSingle();
  if (error) throw error;
  return data?.balance_cents ?? 0;
}

// =========================================================
// CONTAS A PAGAR/RECEBER (4.8)
// =========================================================

export interface BillRow {
  id: string;
  spaceId: string | null;
  direction: BillDirection;
  description: string;
  contactId: string | null;
  categoryId: string | null;
  accountId: string | null;
  amountCents: number;
  paidCents: number;
  dueOn: string;
  status: BillStatus;
  recurringId: string | null;
  statementId: string | null;
  attachmentId: string | null;
  barcode: string | null;
  pixCode: string | null;
  notes: string | null;
  paidAt: string | null;
  /** `status='open' and due_on < hoje` (calculado na consulta, sem job — 4.8). */
  overdue: boolean;
}

const BILL_COLUMNS =
  "id, space_id, direction, description, contact_id, category_id, account_id, amount_cents, paid_cents, due_on, status, recurring_id, statement_id, attachment_id, barcode, pix_code, notes, paid_at";

function mapBillRow(row: Record<string, unknown>, today: string): BillRow {
  const status = row.status as BillStatus;
  const dueOn = row.due_on as string;
  return {
    id: row.id as string,
    spaceId: row.space_id as string | null,
    direction: row.direction as BillDirection,
    description: row.description as string,
    contactId: row.contact_id as string | null,
    categoryId: row.category_id as string | null,
    accountId: row.account_id as string | null,
    amountCents: row.amount_cents as number,
    paidCents: row.paid_cents as number,
    dueOn,
    status,
    recurringId: row.recurring_id as string | null,
    statementId: row.statement_id as string | null,
    attachmentId: row.attachment_id as string | null,
    barcode: row.barcode as string | null,
    pixCode: row.pix_code as string | null,
    notes: row.notes as string | null,
    paidAt: row.paid_at as string | null,
    overdue: status === "open" && dueOn < today,
  };
}

/** Contas por aba (4.8) — "payable"/"receivable" só as ainda abertas/parciais dessa direção; "paid" só pagas; "all" sem filtro. */
export async function listBills(supabase: Client, filters: BillFilters, today: string): Promise<BillRow[]> {
  let query = supabase.from("fin_bills").select(BILL_COLUMNS);

  if (filters.tab === "payable" || filters.tab === "receivable") {
    query = query.eq("direction", filters.tab).in("status", ["open", "partial"]);
  } else if (filters.tab === "paid") {
    query = query.eq("status", "paid");
  }
  if (filters.spaceId) query = query.eq("space_id", filters.spaceId);

  const { data, error } = await query.order("due_on", { ascending: true });
  if (error) throw error;
  return data.map((row) => mapBillRow(row, today));
}

export async function getBill(supabase: Client, id: string, today: string): Promise<BillRow | null> {
  const { data, error } = await supabase.from("fin_bills").select(BILL_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapBillRow(data, today) : null;
}

// =========================================================
// RECORRÊNCIAS (4.8)
// =========================================================

export interface RecurringRow {
  id: string;
  spaceId: string | null;
  description: string;
  direction: BillDirection;
  amountCents: number;
  amountIsEstimate: boolean;
  categoryId: string | null;
  accountId: string | null;
  contactId: string | null;
  rrule: string;
  nextDueOn: string;
  endsOn: string | null;
  remindDaysBefore: number | null;
  active: boolean;
}

const RECURRING_COLUMNS =
  "id, space_id, description, direction, amount_cents, amount_is_estimate, category_id, account_id, contact_id, rrule, next_due_on, ends_on, remind_days_before, active";

function mapRecurringRow(row: Record<string, unknown>): RecurringRow {
  return {
    id: row.id as string,
    spaceId: row.space_id as string | null,
    description: row.description as string,
    direction: row.direction as BillDirection,
    amountCents: row.amount_cents as number,
    amountIsEstimate: row.amount_is_estimate as boolean,
    categoryId: row.category_id as string | null,
    accountId: row.account_id as string | null,
    contactId: row.contact_id as string | null,
    rrule: row.rrule as string,
    nextDueOn: row.next_due_on as string,
    endsOn: row.ends_on as string | null,
    remindDaysBefore: row.remind_days_before as number | null,
    active: row.active as boolean,
  };
}

/** Todas as recorrências do dono (4.8) — ativas primeiro, por próximo vencimento. */
export async function listRecurring(supabase: Client): Promise<RecurringRow[]> {
  const { data, error } = await supabase.from("fin_recurring").select(RECURRING_COLUMNS).order("active", { ascending: false }).order("next_due_on", { ascending: true });
  if (error) throw error;
  return data.map(mapRecurringRow);
}

// =========================================================
// DIVISÃO DE CONTAS (4.9)
// =========================================================

export interface SplitRow {
  id: string;
  title: string;
  totalCents: number;
  occurredOn: string;
  paidByContactId: string | null;
  method: SplitMethod;
  transactionId: string | null;
  groupLabel: string | null;
  attachmentId: string | null;
  status: SplitStatus;
  notes: string | null;
}

const SPLIT_COLUMNS = "id, title, total_cents, occurred_on, paid_by_contact_id, method, transaction_id, group_label, attachment_id, status, notes";

function mapSplitRow(row: Record<string, unknown>): SplitRow {
  return {
    id: row.id as string,
    title: row.title as string,
    totalCents: row.total_cents as number,
    occurredOn: row.occurred_on as string,
    paidByContactId: row.paid_by_contact_id as string | null,
    method: row.method as SplitMethod,
    transactionId: row.transaction_id as string | null,
    groupLabel: row.group_label as string | null,
    attachmentId: row.attachment_id as string | null,
    status: row.status as SplitStatus,
    notes: row.notes as string | null,
  };
}

export interface SplitFilters {
  status?: SplitStatus;
  groupLabel?: string;
}

/** Divisões do dono, mais recente primeiro — lista de `/financas/dividir` (4.9). */
export async function listSplits(supabase: Client, filters: SplitFilters = {}): Promise<SplitRow[]> {
  let query = supabase.from("fin_splits").select(SPLIT_COLUMNS);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.groupLabel) query = query.eq("group_label", filters.groupLabel);

  const { data, error } = await query.order("occurred_on", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapSplitRow);
}

export async function getSplit(supabase: Client, id: string): Promise<SplitRow | null> {
  const { data, error } = await supabase.from("fin_splits").select(SPLIT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapSplitRow(data) : null;
}

/** Rótulos de grupo em uso (ex.: "Viagem Floripa") entre as divisões ainda não canceladas — alimenta o seletor da "visão de acerto" (4.9). */
export async function listSplitGroupLabels(supabase: Client): Promise<string[]> {
  const { data, error } = await supabase.from("fin_splits").select("group_label").not("group_label", "is", null).neq("status", "canceled");
  if (error) throw error;
  return [...new Set(data.map((row) => row.group_label as string))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export interface SplitShareRow {
  id: string;
  splitId: string;
  /** `null` = minha parte. */
  contactId: string | null;
  weight: number | null;
  shareCents: number;
  settledCents: number;
  settledAt: string | null;
  settlementTransactionId: string | null;
}

const SPLIT_SHARE_COLUMNS = "id, split_id, contact_id, weight, share_cents, settled_cents, settled_at, settlement_transaction_id";

function mapSplitShareRow(row: Record<string, unknown>): SplitShareRow {
  return {
    id: row.id as string,
    splitId: row.split_id as string,
    contactId: row.contact_id as string | null,
    weight: row.weight as number | null,
    shareCents: row.share_cents as number,
    settledCents: row.settled_cents as number,
    settledAt: row.settled_at as string | null,
    settlementTransactionId: row.settlement_transaction_id as string | null,
  };
}

export async function listSplitShares(supabase: Client, splitId: string): Promise<SplitShareRow[]> {
  const { data, error } = await supabase.from("fin_split_shares").select(SPLIT_SHARE_COLUMNS).eq("split_id", splitId);
  if (error) throw error;
  return data.map(mapSplitShareRow);
}

/** Partes de várias divisões de uma vez (ex.: todas as de um grupo, pra `computeNetBalances`) — evita 1 consulta por divisão. */
export async function listSplitSharesForSplits(supabase: Client, splitIds: string[]): Promise<SplitShareRow[]> {
  if (splitIds.length === 0) return [];
  const { data, error } = await supabase.from("fin_split_shares").select(SPLIT_SHARE_COLUMNS).in("split_id", splitIds);
  if (error) throw error;
  return data.map(mapSplitShareRow);
}

/**
 * Saldo por contato (view `fin_contact_balances`, 4.2): positivo = o
 * contato me deve, negativo = eu devo a ele. A view devolve até duas linhas
 * por contato (uma de cada direção — "ele me deve" e "eu devo a ele", conforme
 * quem pagou cada divisão), por isso soma aqui em vez de confiar numa linha só.
 */
export async function listContactBalances(supabase: Client): Promise<Map<string, number>> {
  const { data, error } = await supabase.from("fin_contact_balances").select("contact_id, balance_cents");
  if (error) throw error;

  const balances = new Map<string, number>();
  for (const row of data) {
    if (!row.contact_id) continue;
    balances.set(row.contact_id, (balances.get(row.contact_id) ?? 0) + (row.balance_cents ?? 0));
  }
  return balances;
}

export interface LinkableTransactionRow {
  id: string;
  description: string;
  amountCents: number;
  occurredOn: string;
}

/**
 * Despesas recentes (últimos `sinceDate`, kind normal, valor negativo) ainda
 * não vinculadas a nenhuma divisão — alimenta "vincular a um lançamento
 * existente" (4.9). Não filtra por conta/espaço: a lista de divisões é
 * pequena o bastante pra não precisar de busca paginada.
 */
export async function listUnlinkedExpenseTransactions(supabase: Client, sinceDate: string): Promise<LinkableTransactionRow[]> {
  const { data: linkedRows, error: linkedError } = await supabase.from("fin_splits").select("transaction_id").not("transaction_id", "is", null);
  if (linkedError) throw linkedError;
  const linkedIds = new Set(linkedRows.map((row) => row.transaction_id as string));

  const { data, error } = await supabase
    .from("fin_transactions")
    .select("id, description, amount_cents, occurred_on")
    .eq("kind", "normal")
    .lt("amount_cents", 0)
    .gte("occurred_on", sinceDate)
    .order("occurred_on", { ascending: false })
    .limit(100);
  if (error) throw error;

  return data.filter((row) => !linkedIds.has(row.id)).map((row) => ({ id: row.id, description: row.description, amountCents: row.amount_cents, occurredOn: row.occurred_on }));
}
