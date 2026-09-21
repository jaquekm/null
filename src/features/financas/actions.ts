"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { parseBRL } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { computeMissingChildCategories, computeMissingTopCategories, DEFAULT_CATEGORIES } from "./lib/default-categories";
import { createAccountSchema, createCategorySchema, createPixKeySchema, renameCategorySchema, type CreateAccountInput, type CreateCategoryInput, type CreatePixKeyInput } from "./schemas";

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";

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
