"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { parseBRL } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";
import { createHubCostSchema, createSubscriptionSchema, type CreateHubCostInput, type CreateSubscriptionInput } from "./schemas";

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";
const PATH = "/configuracoes/custos";

export async function createSubscription(input: CreateSubscriptionInput): Promise<Result<{ id: string }>> {
  const parsed = createSubscriptionSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  let monthlyCostCents: number;
  try {
    monthlyCostCents = parseBRL(parsed.data.monthlyCost);
  } catch {
    return fail("Dados inválidos.", { monthlyCost: ["Valor inválido."] });
  }

  const { supabase, user } = await requireOwner();
  const { data, error } = await supabase
    .from("subscriptions_tracker")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      monthly_cost_cents: monthlyCostCents,
      replaced_in_phase: parsed.data.replacedInPhase || null,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();
  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath(PATH);
  return ok({ id: data.id });
}

/** Marca a assinatura como cancelada de verdade — é isto que vira economia realizada (`computeSubscriptionSavings`). */
export async function cancelSubscription(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase
    .from("subscriptions_tracker")
    .update({ canceled_at: new Date().toISOString().slice(0, 10) })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(PATH);
  return ok(null);
}

export async function deleteSubscription(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("subscriptions_tracker").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(PATH);
  return ok(null);
}

export async function createHubCost(input: CreateHubCostInput): Promise<Result<{ id: string }>> {
  const parsed = createHubCostSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  let amountCents: number;
  try {
    amountCents = parseBRL(parsed.data.amount);
  } catch {
    return fail("Dados inválidos.", { amount: ["Valor inválido."] });
  }

  const { supabase, user } = await requireOwner();
  const { data, error } = await supabase
    .from("hub_costs")
    .upsert(
      {
        owner_id: user.id,
        reference_month: `${parsed.data.referenceMonth}-01`,
        category: parsed.data.category,
        amount_cents: amountCents,
        notes: parsed.data.notes || null,
      },
      { onConflict: "owner_id,reference_month,category" },
    )
    .select("id")
    .single();
  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath(PATH);
  return ok({ id: data.id });
}

export async function deleteHubCost(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("hub_costs").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(PATH);
  return ok(null);
}
