"use server";

import { formatInTimeZone } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildRRuleString, nextOccurrence } from "@/features/reminders/lib/recurrence";
import { requireOwner } from "@/lib/auth";
import { parseBRL } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";
import type { Database, Json } from "@/lib/supabase/database.types";
import { computeMissingChildCategories, computeMissingTopCategories, DEFAULT_CATEGORIES } from "./lib/default-categories";
import { recurrencePresetForRepeat, recurringDirectionForType } from "./lib/build-recurring-from-transaction";
import { buildInstallments } from "./lib/installments";
import { computeOccurrenceIndexes, importHash } from "./lib/import-hash";
import { matchBills } from "./lib/match-bills";
import { matchRule, ruleMatchesTransaction, type CategorizationRule } from "./lib/match-rule";
import { suggestCategoryId } from "./lib/suggest-category";
import { computeTransactionTotals, type TransactionTotals } from "./lib/transaction-totals";
import {
  getLastCsvMapping,
  getUserTimezone,
  listAccounts,
  listExistingImportHashes,
  listOpenBillsForMatching,
  listRecentCategorizedTransactions,
  listRules,
  listTransactions,
  listTransactionsForRuleTest,
  type TransactionRow,
} from "./queries";
import {
  bulkCategorizeSchema,
  confirmImportSchema,
  createAccountSchema,
  createCategorySchema,
  createPixKeySchema,
  createTransactionSchema,
  previewImportSchema,
  quickExpenseSchema,
  renameCategorySchema,
  ruleInputSchema,
  transactionFiltersSchema,
  updateTransactionCategorySchema,
  updateTransactionDescriptionSchema,
  type ConfirmImportInput,
  type CreateAccountInput,
  type CreateCategoryInput,
  type CreatePixKeyInput,
  type CreateTransactionInput,
  type DeleteTransactionScope,
  type PreviewImportInput,
  type QuickExpenseInput,
  type RuleInput,
  type TransactionFilters,
} from "./schemas";

type Client = SupabaseClient<Database>;

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";
const LANCAMENTOS_PATH = "/financas/lancamentos";
const IMPORTAR_PATH = "/financas/importar";
const REGRAS_PATH = "/financas/regras";

/** "Aplicação: ... incrementa `times_applied`" (4.6) — chamado só quando a sugestão da regra realmente vira o dado salvo (não quando é só mostrada como sugestão e depois trocada). */
async function incrementRuleTimesApplied(supabase: Client, ruleId: string): Promise<void> {
  const { data: rule } = await supabase.from("fin_rules").select("times_applied").eq("id", ruleId).maybeSingle();
  if (!rule) return;
  await supabase
    .from("fin_rules")
    .update({ times_applied: rule.times_applied + 1 })
    .eq("id", ruleId);
}

/** Cria uma conta (4.3) — saldo inicial e limite de cartão em texto (`parseBRL`, 4.1), nunca `float` no banco. */
export async function createAccount(input: CreateAccountInput): Promise<Result<{ id: string }>> {
  const parsed = createAccountSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  let openingBalanceCents: number;
  try {
    openingBalanceCents = parseBRL(parsed.data.openingBalance);
  } catch {
    return fail("Dados inválidos.", { openingBalance: ["Valor inválido."] });
  }

  let creditLimitCents: number | null = null;
  if (parsed.data.creditLimit) {
    try {
      creditLimitCents = parseBRL(parsed.data.creditLimit);
    } catch {
      return fail("Dados inválidos.", { creditLimit: ["Valor inválido."] });
    }
  }

  const { supabase, user } = await requireOwner();

  const { data, error } = await supabase
    .from("fin_accounts")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      kind: parsed.data.kind,
      institution: parsed.data.institution || null,
      space_id: parsed.data.spaceId || null,
      opening_balance_cents: openingBalanceCents,
      opening_date: parsed.data.openingDate,
      credit_limit_cents: creditLimitCents,
      closing_day: parsed.data.closingDay ?? null,
      due_day: parsed.data.dueDay ?? null,
      payment_account_id: parsed.data.paymentAccountId || null,
    })
    .select("id")
    .single();
  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath("/financas/configurar");
  return ok({ id: data.id });
}

export async function archiveAccount(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("fin_accounts").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);
  revalidatePath("/financas/configurar");
  return ok(null);
}

/** Insere só o que ainda falta — idempotente, pode chamar de novo sem duplicar (ver `default-categories.ts`). */
export async function seedDefaultCategories(): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { data: existingRaw, error: existingError } = await supabase.from("fin_categories").select("id, parent_id, name, kind").is("archived_at", null);
  if (existingError) return fail(GENERIC_ERROR);
  const existing = existingRaw.map((row) => ({ id: row.id, parentId: row.parent_id, name: row.name, kind: row.kind as "income" | "expense" }));

  const missingTop = computeMissingTopCategories(existing, DEFAULT_CATEGORIES);
  if (missingTop.length > 0) {
    const { error } = await supabase.from("fin_categories").insert(missingTop.map((c) => ({ owner_id: user.id, name: c.name, kind: c.kind })));
    if (error) return fail(GENERIC_ERROR);
  }

  const { data: allTop, error: topError } = await supabase.from("fin_categories").select("id, name, kind").is("parent_id", null);
  if (topError) return fail(GENERIC_ERROR);
  const topIdByKey = new Map(allTop.map((row) => [`${row.kind}:${row.name}`, row.id]));

  const missingChildren = computeMissingChildCategories(existing, topIdByKey, DEFAULT_CATEGORIES);
  if (missingChildren.length > 0) {
    const { error } = await supabase
      .from("fin_categories")
      .insert(missingChildren.map((c) => ({ owner_id: user.id, parent_id: c.parentId, name: c.name, kind: c.kind })));
    if (error) return fail(GENERIC_ERROR);
  }

  revalidatePath("/financas/configurar");
  return ok(null);
}

export async function createCategory(input: CreateCategoryInput): Promise<Result<{ id: string }>> {
  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  const { supabase, user } = await requireOwner();
  const { data, error } = await supabase
    .from("fin_categories")
    .insert({ owner_id: user.id, name: parsed.data.name, kind: parsed.data.kind, parent_id: parsed.data.parentId || null })
    .select("id")
    .single();
  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath("/financas/configurar");
  return ok({ id: data.id });
}

export async function renameCategory(id: string, name: string): Promise<Result<null>> {
  const parsed = renameCategorySchema.safeParse({ name });
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("fin_categories").update({ name: parsed.data.name }).eq("id", id).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/financas/configurar");
  return ok(null);
}

export async function archiveCategory(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("fin_categories").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);
  revalidatePath("/financas/configurar");
  return ok(null);
}

export async function createPixKey(input: CreatePixKeyInput): Promise<Result<{ id: string }>> {
  const parsed = createPixKeySchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  const { supabase, user } = await requireOwner();

  if (parsed.data.isDefault) {
    await supabase.from("fin_pix_keys").update({ is_default: false }).eq("owner_id", user.id);
  }

  const { data, error } = await supabase
    .from("fin_pix_keys")
    .insert({
      owner_id: user.id,
      label: parsed.data.label,
      key_type: parsed.data.keyType,
      key_value: parsed.data.keyValue,
      merchant_name: parsed.data.merchantName,
      merchant_city: parsed.data.merchantCity,
      space_id: parsed.data.spaceId || null,
      is_default: parsed.data.isDefault,
    })
    .select("id")
    .single();
  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath("/financas/configurar");
  return ok({ id: data.id });
}

/** `fin_pix_keys` não tem `archived_at` (enunciado) — remover é excluir de verdade. */
export async function deletePixKey(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("fin_pix_keys").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);
  revalidatePath("/financas/configurar");
  return ok(null);
}

export async function setDefaultPixKey(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  await supabase.from("fin_pix_keys").update({ is_default: false }).eq("owner_id", user.id);
  const { error } = await supabase.from("fin_pix_keys").update({ is_default: true }).eq("id", id).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);
  revalidatePath("/financas/configurar");
  return ok(null);
}

export async function setFinanceAiEnabled(enabled: boolean): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { data: current } = await supabase.from("user_settings").select("preferences").eq("owner_id", user.id).maybeSingle();
  const preferences = { ...((current?.preferences as Record<string, unknown> | null) ?? {}), financeAiEnabled: enabled };

  const { error } = await supabase.from("user_settings").upsert({ owner_id: user.id, preferences: preferences as unknown as Json }, { onConflict: "owner_id" });
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/financas/configurar");
  return ok(null);
}

/** Marca o onboarding financeiro como concluído — não bloqueia nada (contas/categorias/Pix já foram salvas direto), só evita redirecionar de novo. */
export async function completeFinanceOnboarding(): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { data: current } = await supabase.from("user_settings").select("preferences").eq("owner_id", user.id).maybeSingle();
  const preferences = { ...((current?.preferences as Record<string, unknown> | null) ?? {}), financeOnboardingCompletedAt: new Date().toISOString() };

  const { error } = await supabase.from("user_settings").upsert({ owner_id: user.id, preferences: preferences as unknown as Json }, { onConflict: "owner_id" });
  if (error) return fail(GENERIC_ERROR);

  return ok(null);
}

// =========================================================
// LANÇAMENTOS (4.4)
// =========================================================

/** Lista + totais do filtro (4.4) — leitura, não mutação, por isso devolve os dados direto em vez de `Result` (mesmo padrão de `searchContacts`). Filtro inválido devolve vazio em vez de lançar. */
export async function searchTransactions(filters: TransactionFilters): Promise<{ rows: TransactionRow[]; totals: TransactionTotals }> {
  const parsed = transactionFiltersSchema.safeParse(filters);
  const { supabase } = await requireOwner();
  if (!parsed.success) return { rows: [], totals: { incomeCents: 0, expenseCents: 0, resultCents: 0 } };

  const rows = await listTransactions(supabase, parsed.data);
  return { rows, totals: computeTransactionTotals(rows) };
}

/** "Gasto rápido" (4.4): sugere a categoria da transação mais recente com descrição parecida. */
export async function suggestCategoryForDescription(description: string): Promise<string | null> {
  const { supabase } = await requireOwner();
  const recent = await listRecentCategorizedTransactions(supabase);
  return suggestCategoryId(recent, description);
}

/**
 * Cria um lançamento (4.4): despesa/receita (uma linha, ou N parcelas no
 * cartão) ou transferência (duas linhas com o mesmo `transfer_group_id`).
 * "Ao salvar sem categoria, aplicar regras" (4.6) ainda não existe — a
 * categorização automática por regra fica pra quando a 4.6 for implementada.
 */
export async function createTransaction(input: CreateTransactionInput): Promise<Result<{ ids: string[] }>> {
  const parsed = createTransactionSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);
  const data = parsed.data;

  let amountCents: number;
  try {
    amountCents = Math.abs(parseBRL(data.amount));
  } catch {
    return fail("Dados inválidos.", { amount: ["Valor inválido."] });
  }
  if (amountCents === 0) return fail("Dados inválidos.", { amount: ["O valor não pode ser zero."] });

  const { supabase, user } = await requireOwner();
  const accounts = await listAccounts(supabase);

  if (data.type === "transfer") {
    const fromAccount = accounts.find((a) => a.id === data.fromAccountId);
    const toAccount = accounts.find((a) => a.id === data.toAccountId);
    if (!fromAccount || !toAccount) return fail("Conta inválida.");

    const transferGroupId = crypto.randomUUID();
    const spaceId = data.spaceId || fromAccount.spaceId || null;

    const { data: inserted, error } = await supabase
      .from("fin_transactions")
      .insert([
        {
          owner_id: user.id,
          account_id: fromAccount.id,
          space_id: spaceId,
          description: data.description,
          amount_cents: -amountCents,
          occurred_on: data.occurredOn,
          kind: "transfer" as const,
          transfer_group_id: transferGroupId,
          tags: data.tags,
          notes: data.notes || null,
        },
        {
          owner_id: user.id,
          account_id: toAccount.id,
          space_id: spaceId,
          description: data.description,
          amount_cents: amountCents,
          occurred_on: data.occurredOn,
          kind: "transfer" as const,
          transfer_group_id: transferGroupId,
          tags: data.tags,
          notes: data.notes || null,
        },
      ])
      .select("id");
    if (error || !inserted) return fail(GENERIC_ERROR);

    revalidatePath(LANCAMENTOS_PATH);
    return ok({ ids: inserted.map((r) => r.id) });
  }

  const account = accounts.find((a) => a.id === data.accountId);
  if (!account) return fail("Conta inválida.");
  const spaceId = data.spaceId || account.spaceId || null;
  const signedAmount = data.type === "expense" ? -amountCents : amountCents;

  // "Ao salvar sem categoria, aplicar regras" (4.4/4.6) — só entra em ação quando o dono não escolheu categoria no formulário.
  let matchedRule: CategorizationRule | null = null;
  if (!data.categoryId) {
    const rules = await listRules(supabase);
    matchedRule = matchRule({ description: data.description, originalDescription: null, accountId: account.id, amountCents: signedAmount }, rules);
  }
  const categoryId = data.categoryId || matchedRule?.setCategoryId || null;
  const contactId = data.contactId || matchedRule?.setContactId || null;
  const ruleAppliedCategory = matchedRule?.setCategoryId != null && categoryId === matchedRule.setCategoryId;

  if (data.installments > 1) {
    if (account.kind !== "credit_card") {
      return fail("Dados inválidos.", { installments: ["Parcelamento é só para contas de cartão de crédito."] });
    }

    // `statement_id` fica nulo aqui — vincular cada parcela à fatura do período (`statementFor`) é a 4.7, ainda não implementada.
    const plan = buildInstallments(data.occurredOn, signedAmount, data.installments);
    const installmentGroupId = crypto.randomUUID();
    const rows = plan.map((p) => ({
      owner_id: user.id,
      account_id: account.id,
      space_id: spaceId,
      category_id: categoryId,
      contact_id: contactId,
      description: data.description,
      amount_cents: p.amountCents,
      occurred_on: p.occurredOn,
      kind: "normal" as const,
      installment_group_id: installmentGroupId,
      installment_number: p.installmentNumber,
      installment_total: p.installmentTotal,
      tags: data.tags,
      notes: data.notes || null,
    }));

    const { data: inserted, error } = await supabase.from("fin_transactions").insert(rows).select("id");
    if (error || !inserted) return fail(GENERIC_ERROR);
    if (ruleAppliedCategory && matchedRule) await incrementRuleTimesApplied(supabase, matchedRule.id);

    revalidatePath(LANCAMENTOS_PATH);
    return ok({ ids: inserted.map((r) => r.id) });
  }

  const { data: insertedRow, error } = await supabase
    .from("fin_transactions")
    .insert({
      owner_id: user.id,
      account_id: account.id,
      space_id: spaceId,
      category_id: categoryId,
      contact_id: contactId,
      description: data.description,
      amount_cents: signedAmount,
      occurred_on: data.occurredOn,
      kind: "normal",
      tags: data.tags,
      notes: data.notes || null,
    })
    .select("id")
    .single();
  if (error || !insertedRow) return fail(GENERIC_ERROR);
  if (ruleAppliedCategory && matchedRule) await incrementRuleTimesApplied(supabase, matchedRule.id);

  if (data.repeat !== "none") {
    await createRecurringFromTransaction(supabase, {
      ownerId: user.id,
      type: data.type,
      repeat: data.repeat,
      occurredOn: data.occurredOn,
      description: data.description,
      amountCents,
      categoryId: data.categoryId || null,
      contactId: data.contactId || null,
      accountId: account.id,
      spaceId,
    });
  }

  revalidatePath(LANCAMENTOS_PATH);
  return ok({ ids: [insertedRow.id] });
}

/**
 * "Repetir" (4.4): cria a linha em `fin_recurring` a partir do lançamento
 * que acabou de ser salvo. Só a geração de contas futuras a partir dela
 * (job `generate_bills`, página `/financas/recorrencias`) é da 4.8 — aqui só
 * garante que a recorrência fica registrada. Falha aqui não desfaz o
 * lançamento (já salvo): o dono pode configurar a recorrência de novo depois
 * se isto não der certo.
 */
async function createRecurringFromTransaction(
  supabase: Client,
  input: {
    ownerId: string;
    type: "expense" | "income";
    repeat: "weekly" | "monthly" | "yearly";
    occurredOn: string;
    description: string;
    amountCents: number;
    categoryId: string | null;
    contactId: string | null;
    accountId: string;
    spaceId: string | null;
  },
): Promise<void> {
  const preset = recurrencePresetForRepeat(input.repeat, input.occurredOn);
  if (!preset) return;

  const timezone = await getUserTimezone(supabase, input.ownerId);
  // meio-dia evita que a conversão de fuso empurre a data pro dia anterior/seguinte perto da meia-noite.
  const dtstart = new Date(`${input.occurredOn}T12:00:00`);
  const rrule = buildRRuleString(preset, dtstart, timezone);
  if (!rrule) return;

  const next = nextOccurrence(rrule, timezone, dtstart);
  if (!next) return;

  await supabase.from("fin_recurring").insert({
    owner_id: input.ownerId,
    space_id: input.spaceId,
    description: input.description,
    direction: recurringDirectionForType(input.type),
    amount_cents: input.amountCents,
    category_id: input.categoryId,
    account_id: input.accountId,
    contact_id: input.contactId,
    rrule,
    next_due_on: formatInTimeZone(next, timezone, "yyyy-MM-dd"),
  });
}

/** Edição inline de categoria (4.4) — `null` remove a categoria. */
export async function updateTransactionCategory(id: string, categoryId: string | null): Promise<Result<null>> {
  const parsed = updateTransactionCategorySchema.safeParse({ categoryId });
  if (!parsed.success) return fail("Categoria inválida.");

  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("fin_transactions").update({ category_id: parsed.data.categoryId }).eq("id", id).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(LANCAMENTOS_PATH);
  return ok(null);
}

/** Edição inline de descrição (4.4). */
export async function updateTransactionDescription(id: string, description: string): Promise<Result<null>> {
  const parsed = updateTransactionDescriptionSchema.safeParse({ description });
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("fin_transactions").update({ description: parsed.data.description }).eq("id", id).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(LANCAMENTOS_PATH);
  return ok(null);
}

/** Seleção múltipla → categorizar em lote (4.4). */
export async function bulkCategorizeTransactions(input: { ids: string[]; categoryId: string }): Promise<Result<null>> {
  const parsed = bulkCategorizeSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("fin_transactions").update({ category_id: parsed.data.categoryId }).eq("owner_id", user.id).in("id", parsed.data.ids);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(LANCAMENTOS_PATH);
  return ok(null);
}

/**
 * Exclui um lançamento (4.4). Transferência: as duas pernas (mesmo
 * `transfer_group_id`) somem juntas — não faz sentido deixar só uma perna.
 * Parcela: `scope: "future"` remove esta e as seguintes (mesmo grupo,
 * `installment_number >=` a desta); `"this"` (padrão) remove só esta.
 */
export async function deleteTransaction(id: string, scope: DeleteTransactionScope = "this"): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { data: row, error: readError } = await supabase
    .from("fin_transactions")
    .select("id, kind, transfer_group_id, installment_group_id, installment_number")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (readError || !row) return fail("Lançamento não encontrado.");

  if (row.kind === "transfer" && row.transfer_group_id) {
    const { error } = await supabase.from("fin_transactions").delete().eq("owner_id", user.id).eq("transfer_group_id", row.transfer_group_id);
    if (error) return fail(GENERIC_ERROR);
  } else if (row.installment_group_id && scope === "future" && row.installment_number != null) {
    const { error } = await supabase
      .from("fin_transactions")
      .delete()
      .eq("owner_id", user.id)
      .eq("installment_group_id", row.installment_group_id)
      .gte("installment_number", row.installment_number);
    if (error) return fail(GENERIC_ERROR);
  } else {
    const { error } = await supabase.from("fin_transactions").delete().eq("id", id).eq("owner_id", user.id);
    if (error) return fail(GENERIC_ERROR);
  }

  revalidatePath(LANCAMENTOS_PATH);
  return ok(null);
}

/** "Gasto rápido" (4.4): despesa direta, sem passar pelo formulário completo. */
export async function createQuickExpense(input: QuickExpenseInput): Promise<Result<{ id: string }>> {
  const parsed = quickExpenseSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  let amountCents: number;
  try {
    amountCents = Math.abs(parseBRL(parsed.data.amount));
  } catch {
    return fail("Dados inválidos.", { amount: ["Valor inválido."] });
  }
  if (amountCents === 0) return fail("Dados inválidos.", { amount: ["O valor não pode ser zero."] });

  const { supabase, user } = await requireOwner();
  const accounts = await listAccounts(supabase);
  const account = accounts.find((a) => a.id === parsed.data.accountId);
  if (!account) return fail("Conta inválida.");

  const { data, error } = await supabase
    .from("fin_transactions")
    .insert({
      owner_id: user.id,
      account_id: account.id,
      space_id: account.spaceId,
      category_id: parsed.data.categoryId || null,
      description: parsed.data.description,
      amount_cents: -amountCents,
      occurred_on: parsed.data.occurredOn,
      kind: "normal",
    })
    .select("id")
    .single();
  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath(LANCAMENTOS_PATH);
  return ok({ id: data.id });
}

// =========================================================
// IMPORTAÇÃO DE EXTRATOS (4.5)
// =========================================================

/** Mapeamento salvo da última importação CSV desta conta (se houver) — pré-preenche a tela de mapeamento. */
export async function fetchLastCsvMapping(accountId: string) {
  const { supabase } = await requireOwner();
  return getLastCsvMapping(supabase, accountId);
}

export interface ImportPreviewRow {
  fitid: string | null;
  occurredOn: string | null;
  amountCents: number | null;
  description: string;
  error: string | null;
  hash: string | null;
  status: "new" | "duplicate" | "error";
  matchedBill: { billId: string; description: string } | null;
  suggestedCategoryId: string | null;
}

/**
 * Pré-visualização (4.5): calcula o hash de cada linha (`importHash`,
 * "ordem" via `computeOccurrenceIndexes` pra desempatar linhas idênticas no
 * mesmo arquivo), confere quais já existem nesta conta (`status`), sugere
 * vínculo com uma conta a pagar/receber aberta (`matchBills`) e categoria
 * por regra (`matchRule`, 4.6) nas que são novas. Não grava nada — é só
 * leitura; `times_applied` só sobe em `confirmImport`, quando a sugestão
 * realmente vira o dado salvo.
 */
export async function previewImport(input: PreviewImportInput): Promise<Result<{ rows: ImportPreviewRow[] }>> {
  const parsed = previewImportSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);
  const data = parsed.data;

  const { supabase } = await requireOwner();

  const occurrenceIndexes = computeOccurrenceIndexes(
    data.rows.map((row) => ({ occurredOn: row.occurredOn ?? "", amountCents: row.amountCents ?? 0, description: row.description })),
  );

  const withHash = data.rows.map((row, index) => {
    if (row.error || !row.occurredOn || row.amountCents === null) {
      return { ...row, hash: null as string | null };
    }
    const hash = importHash({
      accountId: data.accountId,
      fitid: row.fitid,
      occurredOn: row.occurredOn,
      amountCents: row.amountCents,
      description: row.description,
      occurrenceIndex: occurrenceIndexes[index]!,
    });
    return { ...row, hash };
  });

  const hashesToCheck = withHash.map((row) => row.hash).filter((hash): hash is string => hash !== null);
  const [existingHashes, openBills, rules] = await Promise.all([
    listExistingImportHashes(supabase, data.accountId, hashesToCheck),
    listOpenBillsForMatching(supabase),
    listRules(supabase),
  ]);

  const rows: ImportPreviewRow[] = withHash.map((row) => {
    if (row.error || !row.hash || !row.occurredOn || row.amountCents === null) {
      return {
        fitid: row.fitid,
        occurredOn: row.occurredOn,
        amountCents: row.amountCents,
        description: row.description,
        error: row.error,
        hash: row.hash,
        status: "error",
        matchedBill: null,
        suggestedCategoryId: null,
      };
    }
    const status = existingHashes.has(row.hash) ? "duplicate" : "new";
    const matchedBill = status === "new" ? matchBills({ amountCents: row.amountCents, occurredOn: row.occurredOn }, openBills) : null;
    const matchedRule =
      status === "new" ? matchRule({ description: row.description, originalDescription: row.description, accountId: data.accountId, amountCents: row.amountCents }, rules) : null;
    return {
      fitid: row.fitid,
      occurredOn: row.occurredOn,
      amountCents: row.amountCents,
      description: row.description,
      error: null,
      hash: row.hash,
      status,
      matchedBill,
      suggestedCategoryId: matchedRule?.setCategoryId ?? null,
    };
  });

  return ok({ rows });
}

/**
 * Ajusta `paid_cents`/`status`/`paid_at` de uma conta a pagar/receber quando
 * um lançamento importado é vinculado a ela (`deltaCents` positivo) ou
 * quando esse vínculo é desfeito (`deltaCents` negativo, `undoImport`).
 * Mesma lógica que a 4.8 ("marcar como paga") vai expor manualmente depois —
 * aqui só a fatia acionada pela conciliação da importação.
 */
async function adjustBillPayment(supabase: Client, billId: string, deltaCents: number): Promise<void> {
  const { data: bill } = await supabase.from("fin_bills").select("amount_cents, paid_cents").eq("id", billId).maybeSingle();
  if (!bill) return;

  const paidCents = Math.max(0, bill.paid_cents + deltaCents);
  const status = paidCents <= 0 ? "open" : paidCents >= bill.amount_cents ? "paid" : "partial";

  await supabase
    .from("fin_bills")
    .update({ paid_cents: paidCents, status, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", billId);
}

/**
 * Confirma a importação (4.5): insere as linhas aceitas (o cliente já filtrou
 * as desmarcadas/com erro) e grava `fin_imports` com os contadores.
 * Reconfere duplicidade contra o banco agora, na hora de gravar — não confia
 * só no status calculado na pré-visualização (que pode ter ficado
 * desatualizado, ex.: outra aba importou o mesmo arquivo nesse meio-tempo) —
 * mesmo cuidado da 4.3 com `computeMissingTopCategories`, um `insert` puro
 * (sem `on conflict`) contra o índice único parcial de `import_hash` seria
 * arriscado de depender.
 */
export async function confirmImport(input: ConfirmImportInput): Promise<Result<{ importId: string; imported: number; duplicate: number }>> {
  const parsed = confirmImportSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);
  const data = parsed.data;
  if (data.rows.length === 0) return fail("Nenhuma linha selecionada pra importar.");

  const { supabase, user } = await requireOwner();

  const accounts = await listAccounts(supabase);
  const account = accounts.find((a) => a.id === data.accountId);
  if (!account) return fail("Conta inválida.");

  const existingHashes = await listExistingImportHashes(
    supabase,
    data.accountId,
    data.rows.map((row) => row.hash),
  );
  const newRows = data.rows.filter((row) => !existingHashes.has(row.hash));
  const duplicateCount = data.rows.length - newRows.length;

  const { data: importRow, error: importError } = await supabase
    .from("fin_imports")
    .insert({
      owner_id: user.id,
      account_id: account.id,
      format: data.format,
      csv_mapping: (data.csvMapping as unknown as Json) ?? null,
      rows_total: data.rows.length,
      rows_imported: newRows.length,
      rows_duplicate: duplicateCount,
      status: "imported",
    })
    .select("id")
    .single();
  if (importError || !importRow) return fail(GENERIC_ERROR);

  if (newRows.length > 0) {
    const rules = await listRules(supabase);

    const { data: inserted, error: insertError } = await supabase
      .from("fin_transactions")
      .insert(
        newRows.map((row) => ({
          owner_id: user.id,
          account_id: account.id,
          space_id: account.spaceId,
          category_id: row.categoryId || null,
          description: row.description,
          original_description: row.description,
          amount_cents: row.amountCents,
          occurred_on: row.occurredOn,
          status: "cleared" as const,
          kind: "normal" as const,
          import_id: importRow.id,
          import_hash: row.hash,
          external_id: row.fitid,
          bill_id: row.linkBillId || null,
        })),
      )
      .select("bill_id, amount_cents");
    if (insertError || !inserted) return fail(GENERIC_ERROR);

    for (const row of inserted) {
      if (row.bill_id) await adjustBillPayment(supabase, row.bill_id, Math.abs(row.amount_cents));
    }

    // "incrementa times_applied" (4.6) só quando a categoria final salva é a que a regra sugeriu — recalcula em vez de confiar num `ruleId` vindo do cliente.
    const appliedRuleIds = new Set<string>();
    for (const row of newRows) {
      if (!row.categoryId) continue;
      const rule = matchRule({ description: row.description, originalDescription: row.description, accountId: account.id, amountCents: row.amountCents }, rules);
      if (rule && rule.setCategoryId === row.categoryId) appliedRuleIds.add(rule.id);
    }
    for (const ruleId of appliedRuleIds) {
      await incrementRuleTimesApplied(supabase, ruleId);
    }
  }

  revalidatePath(IMPORTAR_PATH);
  revalidatePath(LANCAMENTOS_PATH);
  return ok({ importId: importRow.id, imported: newRows.length, duplicate: duplicateCount });
}

/**
 * Desfaz uma importação (4.5, até 7 dias): remove as transações que não
 * foram editadas manualmente depois (`updated_at === created_at` — os dois
 * vêm do mesmo `now()` na hora do `insert`, então continuam iguais até uma
 * `update` de verdade acontecer, inclusive as próprias edições inline da 4.4)
 * e reverte o vínculo com conta a pagar/receber que porventura tivessem.
 */
export async function undoImport(importId: string): Promise<Result<{ removed: number; kept: number }>> {
  const { supabase, user } = await requireOwner();

  const { data: importRow, error: readError } = await supabase
    .from("fin_imports")
    .select("id, created_at, status")
    .eq("id", importId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (readError || !importRow) return fail("Importação não encontrada.");
  if (importRow.status !== "imported") return fail("Esta importação já foi desfeita.");

  const ageMs = Date.now() - new Date(importRow.created_at).getTime();
  if (ageMs > 7 * 24 * 60 * 60 * 1000) return fail("Só é possível desfazer importações de até 7 dias.");

  const { data: candidateRows, error: listError } = await supabase
    .from("fin_transactions")
    .select("id, created_at, updated_at, bill_id, amount_cents")
    .eq("import_id", importId)
    .eq("owner_id", user.id);
  if (listError) return fail(GENERIC_ERROR);

  const untouched = candidateRows.filter((row) => row.updated_at === row.created_at);
  const keptCount = candidateRows.length - untouched.length;

  if (untouched.length > 0) {
    const { error: deleteError } = await supabase
      .from("fin_transactions")
      .delete()
      .in(
        "id",
        untouched.map((row) => row.id),
      )
      .eq("owner_id", user.id);
    if (deleteError) return fail(GENERIC_ERROR);

    for (const row of untouched) {
      if (row.bill_id) await adjustBillPayment(supabase, row.bill_id, -Math.abs(row.amount_cents));
    }
  }

  const { error: updateError } = await supabase.from("fin_imports").update({ status: "undone" }).eq("id", importId).eq("owner_id", user.id);
  if (updateError) return fail(GENERIC_ERROR);

  revalidatePath(IMPORTAR_PATH);
  revalidatePath(LANCAMENTOS_PATH);
  return ok({ removed: untouched.length, kept: keptCount });
}

// =========================================================
// REGRAS DE CATEGORIZAÇÃO (4.6)
// =========================================================

/** `undefined`/vazio → `null` (sem faixa). `"invalid"` → o texto não é um valor válido (`parseBRL`). */
function parseOptionalAmountCents(text: string | undefined): number | null | "invalid" {
  if (!text || !text.trim()) return null;
  try {
    return parseBRL(text);
  } catch {
    return "invalid";
  }
}

interface ParsedRuleAmounts {
  amountMinCents: number | null;
  amountMaxCents: number | null;
}

function parseRuleAmounts(data: RuleInput): Result<never> | ParsedRuleAmounts {
  const amountMinCents = parseOptionalAmountCents(data.amountMin);
  if (amountMinCents === "invalid") return fail("Dados inválidos.", { amountMin: ["Valor inválido."] });
  const amountMaxCents = parseOptionalAmountCents(data.amountMax);
  if (amountMaxCents === "invalid") return fail("Dados inválidos.", { amountMax: ["Valor inválido."] });
  return { amountMinCents, amountMaxCents };
}

export async function createRule(input: RuleInput): Promise<Result<{ id: string }>> {
  const parsed = ruleInputSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);
  const data = parsed.data;

  const amounts = parseRuleAmounts(data);
  if ("ok" in amounts) return amounts;

  const { supabase, user } = await requireOwner();

  const { data: row, error } = await supabase
    .from("fin_rules")
    .insert({
      owner_id: user.id,
      match_field: data.matchField,
      match_type: data.matchType,
      pattern: data.pattern,
      account_id: data.accountId || null,
      amount_min_cents: amounts.amountMinCents,
      amount_max_cents: amounts.amountMaxCents,
      set_category_id: data.setCategoryId || null,
      set_contact_id: data.setContactId || null,
      set_description: data.setDescription || null,
      set_space_id: data.setSpaceId || null,
      priority: data.priority,
    })
    .select("id")
    .single();
  if (error || !row) return fail(GENERIC_ERROR);

  revalidatePath(REGRAS_PATH);
  return ok({ id: row.id });
}

export async function updateRule(id: string, input: RuleInput): Promise<Result<null>> {
  const parsed = ruleInputSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);
  const data = parsed.data;

  const amounts = parseRuleAmounts(data);
  if ("ok" in amounts) return amounts;

  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("fin_rules")
    .update({
      match_field: data.matchField,
      match_type: data.matchType,
      pattern: data.pattern,
      account_id: data.accountId || null,
      amount_min_cents: amounts.amountMinCents,
      amount_max_cents: amounts.amountMaxCents,
      set_category_id: data.setCategoryId || null,
      set_contact_id: data.setContactId || null,
      set_description: data.setDescription || null,
      set_space_id: data.setSpaceId || null,
      priority: data.priority,
    })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(REGRAS_PATH);
  return ok(null);
}

export async function deleteRule(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("fin_rules").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);
  revalidatePath(REGRAS_PATH);
  return ok(null);
}

/** "Testar nos últimos 90 dias" (4.6): quantos lançamentos batem com esta regra (salva ou ainda em edição no formulário) — não grava nada. */
export async function testRule(input: RuleInput): Promise<Result<{ count: number }>> {
  const parsed = ruleInputSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);
  const data = parsed.data;

  const amounts = parseRuleAmounts(data);
  if ("ok" in amounts) return amounts;

  const { supabase } = await requireOwner();

  const candidateRule: CategorizationRule = {
    id: "candidate",
    matchField: data.matchField,
    matchType: data.matchType,
    pattern: data.pattern,
    accountId: data.accountId || null,
    amountMinCents: amounts.amountMinCents,
    amountMaxCents: amounts.amountMaxCents,
    setCategoryId: data.setCategoryId || null,
    setContactId: data.setContactId || null,
    setDescription: data.setDescription || null,
    setSpaceId: data.setSpaceId || null,
    priority: data.priority,
  };

  const since = new Date();
  since.setDate(since.getDate() - 90);
  const transactions = await listTransactionsForRuleTest(supabase, since.toISOString().slice(0, 10));

  const count = transactions.filter((transaction) => ruleMatchesTransaction(candidateRule, transaction)).length;
  return ok({ count });
}
