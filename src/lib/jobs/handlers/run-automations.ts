import { hasAlreadyRun, markRan } from "@/features/automations/lib/chain-guard";
import { matchesTrigger, scopeMatches } from "@/features/automations/lib/match-trigger";
import { recordAutomationRun } from "@/features/automations/lib/record-run";
import { runActionsForItem } from "@/features/automations/lib/run-actions-for-item";
import type { AutomationItemContext } from "@/features/automations/lib/execute-action";
import { MAX_AUTOMATION_CHAIN_DEPTH, automationTriggerSchema, runAutomationsPayloadSchema } from "@/features/automations/schemas";
import type { JobHandler } from "../types";

/**
 * Job `run_automations` (5.3) — reage a um evento de item já detectado
 * (`emitItemEvent`/`emitTagAddedEvent`). Pra cada automação ativa cujo
 * gatilho/escopo bate: proteção contra laço (`automation_event_log`, mesmo
 * `chainId`), condições, executa as ações (`runActionsForItem`) e grava
 * `automation_runs`.
 */
export const runAutomations: JobHandler = async (job, { supabase }) => {
  const parsed = runAutomationsPayloadSchema.safeParse(job.payload);
  if (!parsed.success) return { status: "failed", error: "Payload inválido para run_automations." };
  const payload = parsed.data;

  if (payload.depth > MAX_AUTOMATION_CHAIN_DEPTH) {
    return { status: "done", result: { skipped: "max_chain_depth" } };
  }

  const { data: itemRow, error: itemError } = await supabase
    .from("items")
    .select("id, type_id, space_id, title, status, properties")
    .eq("id", payload.itemId)
    .maybeSingle();
  if (itemError) return { status: "retry", error: itemError.message };
  if (!itemRow) return { status: "done", result: { skipped: "item_not_found" } };

  const item: AutomationItemContext = {
    id: itemRow.id,
    typeId: itemRow.type_id,
    spaceId: itemRow.space_id,
    title: itemRow.title,
    status: itemRow.status,
    properties: (itemRow.properties as Record<string, unknown> | null) ?? {},
  };

  const { data: automations, error: automationsError } = await supabase
    .from("automations")
    .select("*")
    .eq("owner_id", job.owner_id)
    .eq("enabled", true);
  if (automationsError) return { status: "retry", error: automationsError.message };

  let matched = 0;

  for (const automation of automations ?? []) {
    const triggerParsed = automationTriggerSchema.safeParse(automation.trigger);
    if (!triggerParsed.success) continue; // gatilho em formato inválido — nunca dispara, sem quebrar as outras
    if (!matchesTrigger(triggerParsed.data, payload.event)) continue;
    if (!scopeMatches({ typeId: automation.type_id, spaceId: automation.space_id }, { typeId: item.typeId, spaceId: item.spaceId })) continue;

    if (await hasAlreadyRun(supabase, job.owner_id, item.id, automation.id, payload.chainId)) continue; // já rodou nesta cadeia — proteção contra laço

    matched += 1;

    await markRan(supabase, job.owner_id, item.id, automation.id, payload.chainId);

    const outcome = await runActionsForItem(supabase, job.owner_id, automation, item, payload.chainId, payload.depth + 1);

    if (!outcome.conditionsPassed) {
      await recordAutomationRun(supabase, job.owner_id, automation.id, item.id, "skipped", { reason: "conditions" });
      continue;
    }

    await recordAutomationRun(supabase, job.owner_id, automation.id, item.id, outcome.failed ? "failed" : "success", {
      actions: outcome.actionResults,
      error: outcome.error,
    });
    await supabase
      .from("automations")
      .update({ last_run_at: new Date().toISOString(), run_count: automation.run_count + 1 })
      .eq("id", automation.id);
  }

  return { status: "done", result: { automationsMatched: matched } };
};
