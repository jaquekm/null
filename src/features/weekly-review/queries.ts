import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeDayRange } from "@/features/agenda/lib/day-range";
import { extractItemDateEntries, type DateFieldDef, type ItemForDateExtraction } from "@/features/agenda/lib/extract-item-date-entries";
import type { AgendaEntry } from "@/features/agenda/lib/agenda-entry";
import { fetchAgendaEvents } from "@/features/agenda/actions";
import { getUserTimezone } from "@/features/agenda/queries";
import type { BillRow } from "@/features/financas/queries";
import { listBills } from "@/features/financas/queries";
import type { InboxItemRow } from "@/features/items/queries";
import { listInboxItems } from "@/features/items/queries";
import { getObjectTypeBySlug } from "@/features/types/queries";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

const FAR_PAST_ISO = "1970-01-01T00:00:00.000Z";

export interface ProjectInProgressRow {
  id: string;
  title: string;
}

export interface WeeklyReviewData {
  inbox: InboxItemRow[];
  projectsInProgress: ProjectInProgressRow[] | null;
  overdueTasks: AgendaEntry[];
  nextWeekAgenda: AgendaEntry[];
  billsThisWeek: BillRow[] | null;
  timezone: string;
  dateStr: string;
}

/**
 * Reúne os 6 passos da revisão semanal (5.8: "passo a passo guiado") — cada
 * fonte já é uma query existente de outra feature; aqui só orquestra.
 * `projectsInProgress`/`billsThisWeek` ficam `null` quando o pack Projetos
 * não está instalado / o módulo Finanças está desligado (passo pulado, sem
 * erro).
 */
export async function getWeeklyReviewData(supabase: Client, ownerId: string): Promise<WeeklyReviewData> {
  const timezone = await getUserTimezone(supabase, ownerId);
  const today = computeDayRange(new Date(), timezone);
  const weekAhead = computeDayRange(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), timezone);

  const [inbox, projectsInProgress, overdueTasks, nextWeekAgenda, billsThisWeek] = await Promise.all([
    listInboxItems(supabase),
    listProjectsInProgress(supabase, ownerId),
    listOverdueTasks(supabase, ownerId, today.startIso),
    fetchAgendaEvents(today.startIso, weekAhead.endIsoExclusive, { events: true, items: true, reminders: true }),
    listBillsDueThisWeek(supabase, ownerId, today.dateStr, weekAhead.dateStr),
  ]);

  return { inbox, projectsInProgress, overdueTasks, nextWeekAgenda, billsThisWeek, timezone, dateStr: today.dateStr };
}

async function listProjectsInProgress(supabase: Client, ownerId: string): Promise<ProjectInProgressRow[] | null> {
  const projectType = await getObjectTypeBySlug(supabase, "projeto");
  if (!projectType) return null;

  const { data } = await supabase.from("items").select("id, title, properties").eq("owner_id", ownerId).eq("type_id", projectType.id).is("deleted_at", null);
  return (data ?? [])
    .filter((item) => (item.properties as Record<string, unknown> | null)?.status === "em_andamento")
    .map((item) => ({ id: item.id, title: item.title }));
}

async function listOverdueTasks(supabase: Client, ownerId: string, todayStartIso: string): Promise<AgendaEntry[]> {
  const taskType = await getObjectTypeBySlug(supabase, "tarefa");
  if (!taskType) return [];

  const { data } = await supabase.from("items").select("id, title, type_id, properties").eq("owner_id", ownerId).eq("type_id", taskType.id).is("deleted_at", null);
  const items: ItemForDateExtraction[] = (data ?? [])
    .filter((item) => (item.properties as Record<string, unknown> | null)?.status !== "done")
    .map((item) => ({ id: item.id, title: item.title, type_id: item.type_id, properties: (item.properties as Record<string, unknown> | null) ?? {} }));

  const dateFieldsByTypeId = new Map<string, DateFieldDef[]>([[taskType.id, [{ key: "prazo", label: "Prazo", type: "date" }]]]);
  return extractItemDateEntries(items, dateFieldsByTypeId, FAR_PAST_ISO, todayStartIso);
}

async function listBillsDueThisWeek(supabase: Client, ownerId: string, fromDateStr: string, toDateStr: string): Promise<BillRow[] | null> {
  const { data: settings } = await supabase.from("user_settings").select("modules").eq("owner_id", ownerId).maybeSingle();
  const modules = (settings?.modules as Record<string, unknown> | null) ?? {};
  if (modules.finance !== true) return null;

  const bills = await listBills(supabase, { tab: "all" }, fromDateStr);
  return bills.filter((bill) => bill.status !== "paid" && bill.dueOn >= fromDateStr && bill.dueOn <= toDateStr);
}
