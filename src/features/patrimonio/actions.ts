"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import { createNetWorthItemSchema, setDebtRateSchema, setNetWorthSnapshotSchema } from "./schemas";

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";
const PATH = "/financas/patrimonio";

/** "+ Investimento" / "+ Dívida" (10.12). */
export async function createNetWorthItem(input: z.input<typeof createNetWorthItemSchema>): Promise<Result<{ id: string }>> {
  const parsed = createNetWorthItemSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { supabase, user } = await requireOwner();

  const { data, error } = await supabase
    .from("net_worth_items")
    .insert({ owner_id: user.id, kind: parsed.data.kind, name: parsed.data.name })
    .select("id")
    .single();
  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath(PATH);
  return ok({ id: data.id });
}

/** "Registrar valor do mês" — um valor por item por mês (`unique (item_id, month)`), substitui se já tiver registrado esse mês. */
export async function setNetWorthSnapshot(input: z.input<typeof setNetWorthSnapshotSchema>): Promise<Result<null>> {
  const parsed = setNetWorthSnapshotSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("net_worth_snapshots")
    .upsert(
      { owner_id: user.id, item_id: parsed.data.itemId, month: `${parsed.data.month}-01`, value_cents: parsed.data.valueCents },
      { onConflict: "item_id,month" },
    );
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(PATH);
  return ok(null);
}

/** Taxa de juros mensal de uma dívida (10.14), pro plano de quitação sugerir ordem e data prevista. */
export async function setDebtRate(input: z.input<typeof setDebtRateSchema>): Promise<Result<null>> {
  const parsed = setDebtRateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("net_worth_items")
    .update({ monthly_rate_percent: parsed.data.monthlyRatePercent })
    .eq("id", parsed.data.itemId)
    .eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(PATH);
  return ok(null);
}

/** "Excluir" — arquivamento lógico, igual a `fin_accounts` (sai do painel, histórico fica guardado). */
export async function deleteNetWorthItem(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("net_worth_items").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("owner_id", user.id);
  if (error) return fail("Não foi possível excluir.");
  revalidatePath(PATH);
  return ok(null);
}
