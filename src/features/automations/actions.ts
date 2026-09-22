"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { describeAction } from "./lib/describe-action";
import { evaluateConditions } from "./lib/evaluate-conditions";
import { getAutomation } from "./queries";
import { automationInputSchema, type AutomationInput } from "./schemas";

const GENERIC_ERROR = "Não foi possível salvar a automação. Tente de novo.";
const AUTOMATIONS_PATH = "/configuracoes/automacoes";

function toRow(input: AutomationInput) {
  return {
    name: input.name,
    description: input.description || null,
    enabled: input.enabled,
    space_id: input.spaceId,
    type_id: input.typeId,
    trigger: input.trigger as unknown as Json,
    conditions: input.conditions as unknown as Json,
    actions: input.actions as unknown as Json,
  };
}

export async function createAutomation(input: AutomationInput): Promise<Result<{ id: string }>> {
  const parsed = automationInputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR, parsed.error.flatten().fieldErrors);

  const { supabase, user } = await requireOwner();

  const { data, error } = await supabase
    .from("automations")
    .insert({ owner_id: user.id, ...toRow(parsed.data) })
    .select("id")
    .single();
  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath(AUTOMATIONS_PATH);
  return ok({ id: data.id });
}

export async function updateAutomation(id: string, input: AutomationInput): Promise<Result<null>> {
  const parsed = automationInputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR, parsed.error.flatten().fieldErrors);

  const { supabase, user } = await requireOwner();

  const { error } = await supabase.from("automations").update(toRow(parsed.data)).eq("id", id).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(AUTOMATIONS_PATH);
  revalidatePath(`${AUTOMATIONS_PATH}/${id}`);
  return ok(null);
}

export async function deleteAutomation(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase.from("automations").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return fail("Não foi possível excluir a automação.");

  revalidatePath(AUTOMATIONS_PATH);
  return ok(null);
}

export async function toggleAutomation(id: string, enabled: boolean): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase.from("automations").update({ enabled }).eq("id", id).eq("owner_id", user.id);
  if (error) return fail("Não foi possível atualizar a automação.");

  revalidatePath(AUTOMATIONS_PATH);
  return ok(null);
}

export interface TestAutomationResult {
  conditionsPassed: boolean;
  actionDescriptions: string[];
}

/**
 * "Testar com item…" (5.3): simula contra um item de verdade sem aplicar
 * nada — avalia as condições (`evaluateConditions`, a mesma função que o
 * motor usa) e descreve o que cada ação faria (`describeAction`), sem
 * tocar no banco além da leitura do item.
 */
export async function testAutomation(id: string, itemId: string): Promise<Result<TestAutomationResult>> {
  const { supabase, user } = await requireOwner();

  const automation = await getAutomation(supabase, user.id, id);
  if (!automation) return fail("Automação não encontrada.");

  const { data: itemRow, error } = await supabase.from("items").select("title, status, properties").eq("id", itemId).eq("owner_id", user.id).maybeSingle();
  if (error || !itemRow) return fail("Item não encontrado.");

  const item = { title: itemRow.title, status: itemRow.status, properties: (itemRow.properties as Record<string, unknown> | null) ?? {} };
  const conditionsPassed = evaluateConditions(item, automation.conditions);
  const actionDescriptions = automation.actions.map((action) => describeAction(action, item));

  return ok({ conditionsPassed, actionDescriptions });
}
