import { randomUUID } from "node:crypto";
import { formatInTimeZone } from "date-fns-tz";
import { hasAlreadyRun, markRan } from "@/features/automations/lib/chain-guard";
import type { AutomationItemContext } from "@/features/automations/lib/execute-action";
import { recordAutomationRun } from "@/features/automations/lib/record-run";
import { runActionsForItem } from "@/features/automations/lib/run-actions-for-item";
import { automationTriggerSchema, type AutomationTrigger } from "@/features/automations/schemas";
import { nextOccurrence } from "@/features/reminders/lib/recurrence";
import type { Tables } from "@/lib/supabase/database.types";
import type { JobContext } from "../types";
import type { JobHandler } from "../types";

type Client = JobContext["supabase"];
type AutomationRow = Tables<"automations">;

const TIME_CHAIN_ID = "time"; // dispara no máximo uma vez por item/automação — ver decisoes.md

/**
 * `RRule.fromString` sem `DTSTART` ancora no instante do próprio `parse`
 * (`new Date()` truncado ao segundo) — como isso muda a cada chamada, a
 * "próxima ocorrência" nunca fica no passado e a regra nunca parece "vencida"
 * (ver decisoes.md). Se o pack/automação não declarou `DTSTART`, ancora na
 * criação da automação (sempre no passado) usando o mesmo truque de fuso de
 * `features/reminders/lib/recurrence.ts`.
 */
function ensureDtstart(rruleString: string, timezone: string, anchor: Date): string {
  if (rruleString.includes("DTSTART")) return rruleString;
  const rulePart = rruleString.startsWith("RRULE:") ? rruleString.slice("RRULE:".length) : rruleString;
  const floating = formatInTimeZone(anchor, timezone, "yyyyMMdd'T'HHmmss");
  return `DTSTART:${floating}Z\nRRULE:${rulePart}`;
}

function toItemContext(row: { id: string; type_id: string | null; space_id: string | null; title: string; status: string; properties: unknown }): AutomationItemContext {
  return {
    id: row.id,
    typeId: row.type_id,
    spaceId: row.space_id,
    title: row.title,
    status: row.status,
    properties: (row.properties as Record<string, unknown> | null) ?? {},
  };
}

async function runForItem(supabase: Client, ownerId: string, automation: AutomationRow, item: AutomationItemContext): Promise<boolean> {
  if (await hasAlreadyRun(supabase, ownerId, item.id, automation.id, TIME_CHAIN_ID)) return false;
  await markRan(supabase, ownerId, item.id, automation.id, TIME_CHAIN_ID);

  const outcome = await runActionsForItem(supabase, ownerId, automation, item, `${TIME_CHAIN_ID}:${randomUUID()}`, 1);
  if (!outcome.conditionsPassed) {
    await recordAutomationRun(supabase, ownerId, automation.id, item.id, "skipped", { reason: "conditions" });
    return true;
  }
  await recordAutomationRun(supabase, ownerId, automation.id, item.id, outcome.failed ? "failed" : "success", {
    actions: outcome.actionResults,
    error: outcome.error,
  });
  await supabase
    .from("automations")
    .update({ last_run_at: new Date().toISOString(), run_count: automation.run_count + 1 })
    .eq("id", automation.id);
  return true;
}

async function evaluateSchedule(supabase: Client, ownerId: string, automation: AutomationRow, trigger: Extract<AutomationTrigger, { type: "schedule" }>, now: Date): Promise<boolean> {
  const lastRun = automation.last_run_at ? new Date(automation.last_run_at) : new Date(0);
  const rruleString = ensureDtstart(trigger.rrule, trigger.timezone, new Date(automation.created_at));
  const due = nextOccurrence(rruleString, trigger.timezone, lastRun);
  if (!due || due.getTime() > now.getTime()) return false;

  const chainId = randomUUID();
  const outcome = await runActionsForItem(supabase, ownerId, automation, null, chainId, 1);
  if (!outcome.conditionsPassed) {
    await recordAutomationRun(supabase, ownerId, automation.id, null, "skipped", { reason: "conditions" });
  } else {
    await recordAutomationRun(supabase, ownerId, automation.id, null, outcome.failed ? "failed" : "success", {
      actions: outcome.actionResults,
      error: outcome.error,
    });
  }
  await supabase
    .from("automations")
    .update({ last_run_at: now.toISOString(), run_count: automation.run_count + 1 })
    .eq("id", automation.id);
  return true;
}

async function evaluateDateReached(supabase: Client, ownerId: string, automation: AutomationRow, trigger: Extract<AutomationTrigger, { type: "date_reached" }>, now: Date): Promise<number> {
  if (!automation.type_id) return 0; // sem tipo, não dá pra saber quais itens olhar

  let query = supabase.from("items").select("id, type_id, space_id, title, status, properties").eq("owner_id", ownerId).eq("type_id", automation.type_id).is("deleted_at", null);
  if (automation.space_id) query = query.eq("space_id", automation.space_id);
  const { data: items } = await query;

  let ran = 0;
  for (const row of items ?? []) {
    const rawValue = (row.properties as Record<string, unknown> | null)?.[trigger.field];
    if (typeof rawValue !== "string") continue;
    const fieldDate = new Date(rawValue);
    if (Number.isNaN(fieldDate.getTime())) continue;

    const dueAt = new Date(fieldDate.getTime() + trigger.offsetMinutes * 60_000);
    if (dueAt.getTime() > now.getTime()) continue;

    if (await runForItem(supabase, ownerId, automation, toItemContext(row))) ran += 1;
  }
  return ran;
}

async function lastActivityAt(supabase: Client, item: { id: string; updatedAt: string }): Promise<number> {
  const [{ data: asSource }, { data: asTarget }] = await Promise.all([
    supabase.from("links").select("target_id").eq("source_id", item.id),
    supabase.from("links").select("source_id").eq("target_id", item.id),
  ]);
  const linkedIds = new Set<string>();
  for (const link of asSource ?? []) linkedIds.add(link.target_id);
  for (const link of asTarget ?? []) linkedIds.add(link.source_id);

  let latest = new Date(item.updatedAt).getTime();
  if (linkedIds.size > 0) {
    const { data: linkedItems } = await supabase.from("items").select("updated_at").in("id", [...linkedIds]);
    for (const linked of linkedItems ?? []) {
      latest = Math.max(latest, new Date(linked.updated_at).getTime());
    }
  }
  return latest;
}

async function evaluateNoActivity(supabase: Client, ownerId: string, automation: AutomationRow, trigger: Extract<AutomationTrigger, { type: "no_activity" }>, now: Date): Promise<number> {
  if (!automation.type_id) return 0;

  let query = supabase.from("items").select("id, type_id, space_id, title, status, properties, updated_at").eq("owner_id", ownerId).eq("type_id", automation.type_id).is("deleted_at", null);
  if (automation.space_id) query = query.eq("space_id", automation.space_id);
  const { data: items } = await query;

  const thresholdMs = trigger.days * 24 * 60 * 60 * 1000;
  let ran = 0;
  for (const row of items ?? []) {
    const latest = await lastActivityAt(supabase, { id: row.id, updatedAt: row.updated_at });
    if (now.getTime() - latest < thresholdMs) continue;

    if (await runForItem(supabase, ownerId, automation, toItemContext(row))) ran += 1;
  }
  return ran;
}

/**
 * Job periódico `evaluate_time_automations` (5.3, a cada 5 min — registrado
 * em `job_schedules` na 1.3/onboarding): avalia os três gatilhos de tempo.
 * `schedule` não depende de item (registra a última execução na própria
 * automação); `date_reached`/`no_activity` disparam **uma vez por item**
 * (`automation_event_log` com `chainId` fixo faz o "não repetir" do
 * enunciado).
 */
export const evaluateTimeAutomations: JobHandler = async (job, { supabase }) => {
  const { data: automations, error } = await supabase.from("automations").select("*").eq("owner_id", job.owner_id).eq("enabled", true);
  if (error) return { status: "retry", error: error.message };

  const now = new Date();
  let scheduleRuns = 0;
  let dateReachedRuns = 0;
  let noActivityRuns = 0;

  for (const automation of automations ?? []) {
    const triggerParsed = automationTriggerSchema.safeParse(automation.trigger);
    if (!triggerParsed.success) continue; // gatilho em formato inválido — ignora, sem quebrar as outras
    const trigger = triggerParsed.data;
    if (trigger.type === "schedule") {
      if (await evaluateSchedule(supabase, job.owner_id, automation, trigger, now)) scheduleRuns += 1;
    } else if (trigger.type === "date_reached") {
      dateReachedRuns += await evaluateDateReached(supabase, job.owner_id, automation, trigger, now);
    } else if (trigger.type === "no_activity") {
      noActivityRuns += await evaluateNoActivity(supabase, job.owner_id, automation, trigger, now);
    }
  }

  return { status: "done", result: { scheduleRuns, dateReachedRuns, noActivityRuns } };
};
