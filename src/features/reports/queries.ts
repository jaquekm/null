import "server-only";
import { nextOccurrence } from "@/features/reminders/lib/recurrence";
import { getUserTimezone } from "@/features/reminders/queries";
import type { Json } from "@/lib/supabase/database.types";
import type { ReportChannel, ReportDefinitionInput, ReportKind } from "./schemas";
import type { Client } from "./types";

export interface SaveReportRunInput {
  definitionId?: string | null;
  kind: ReportKind;
  title: string;
  periodStart: string | null;
  periodEnd: string | null;
  data: unknown;
  aiSummary?: string | null;
}

/** Grava o snapshot de uma execução (6.2) — relatórios antigos não mudam quando os dados mudarem depois. */
export async function saveReportRun(supabase: Client, ownerId: string, input: SaveReportRunInput): Promise<string> {
  const { data, error } = await supabase
    .from("report_runs")
    .insert({
      owner_id: ownerId,
      definition_id: input.definitionId ?? null,
      kind: input.kind,
      title: input.title,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      data: input.data as unknown as Json,
      ai_summary: input.aiSummary ?? null,
      status: "done",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export interface ReportRunRow {
  id: string;
  definitionId: string | null;
  kind: ReportKind;
  title: string;
  periodStart: string | null;
  periodEnd: string | null;
  data: unknown;
  aiSummary: string | null;
  pdfAttachmentId: string | null;
  createdAt: string;
}

function mapReportRun(row: {
  id: string;
  definition_id: string | null;
  kind: string;
  title: string;
  period_start: string | null;
  period_end: string | null;
  data: Json;
  ai_summary: string | null;
  pdf_attachment_id: string | null;
  created_at: string;
}): ReportRunRow {
  return {
    id: row.id,
    definitionId: row.definition_id,
    kind: row.kind as ReportKind,
    title: row.title,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    data: row.data,
    aiSummary: row.ai_summary,
    pdfAttachmentId: row.pdf_attachment_id,
    createdAt: row.created_at,
  };
}

/** Um snapshot específico — tela de relatório (6.4) e reenvio manual ("Enviar"). */
export async function getReportRun(supabase: Client, id: string): Promise<ReportRunRow | null> {
  const { data, error } = await supabase
    .from("report_runs")
    .select("id, definition_id, kind, title, period_start, period_end, data, ai_summary, pdf_attachment_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapReportRun(data) : null;
}

export interface ReportRunListRow {
  id: string;
  definitionId: string | null;
  kind: ReportKind;
  title: string;
  periodStart: string | null;
  periodEnd: string | null;
  pdfAttachmentId: string | null;
  createdAt: string;
}

/** Histórico de execuções, mais recente primeiro — lista da página `/relatorios` (6.4), sem o `data` (snapshot pesado, só a tela de uma execução precisa dele). */
export async function listReportRuns(supabase: Client, limit = 50): Promise<ReportRunListRow[]> {
  const { data, error } = await supabase
    .from("report_runs")
    .select("id, definition_id, kind, title, period_start, period_end, pdf_attachment_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    definitionId: row.definition_id,
    kind: row.kind as ReportKind,
    title: row.title,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    pdfAttachmentId: row.pdf_attachment_id,
    createdAt: row.created_at,
  }));
}

/** Anexa o PDF gerado (6.4, job `generate_report`) a uma execução já salva. */
export async function updateReportRunPdfAttachment(supabase: Client, reportRunId: string, attachmentId: string): Promise<void> {
  const { error } = await supabase.from("report_runs").update({ pdf_attachment_id: attachmentId }).eq("id", reportRunId);
  if (error) throw error;
}

export interface ReportDefinitionRow {
  id: string;
  name: string;
  kind: ReportKind;
  params: Record<string, unknown>;
  scheduleRrule: string | null;
  timezone: string;
  nextRunAt: string | null;
  deliverTo: { me: boolean; contactIds: string[] };
  channels: ReportChannel[];
  includeAiSummary: boolean;
  enabled: boolean;
  createdAt: string;
}

function mapReportDefinition(row: {
  id: string;
  name: string;
  kind: string;
  params: Json;
  schedule_rrule: string | null;
  timezone: string;
  next_run_at: string | null;
  deliver_to: Json;
  channels: string[];
  include_ai_summary: boolean;
  enabled: boolean;
  created_at: string;
}): ReportDefinitionRow {
  const deliverTo = (row.deliver_to as { me?: boolean; contacts?: string[] } | null) ?? {};
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as ReportKind,
    params: (row.params as Record<string, unknown> | null) ?? {},
    scheduleRrule: row.schedule_rrule,
    timezone: row.timezone,
    nextRunAt: row.next_run_at,
    deliverTo: { me: deliverTo.me ?? true, contactIds: deliverTo.contacts ?? [] },
    channels: row.channels as ReportChannel[],
    includeAiSummary: row.include_ai_summary,
    enabled: row.enabled,
    createdAt: row.created_at,
  };
}

const REPORT_DEFINITION_COLUMNS = "id, name, kind, params, schedule_rrule, timezone, next_run_at, deliver_to, channels, include_ai_summary, enabled, created_at";

/** Definições salvas (prontas configuradas ou personalizadas) — lista da página `/relatorios` (6.4) e fila de agendamento (`schedule_reports`, 6.4). */
export async function listReportDefinitions(supabase: Client): Promise<ReportDefinitionRow[]> {
  const { data, error } = await supabase.from("report_definitions").select(REPORT_DEFINITION_COLUMNS).order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapReportDefinition);
}

export async function getReportDefinition(supabase: Client, id: string): Promise<ReportDefinitionRow | null> {
  const { data, error } = await supabase.from("report_definitions").select(REPORT_DEFINITION_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapReportDefinition(data) : null;
}

/** Definições vencidas (6.4, job `schedule_reports`): agendadas, ativas, com `next_run_at` já passado. */
export async function listDueReportDefinitions(supabase: Client, ownerId: string, now: Date): Promise<ReportDefinitionRow[]> {
  const { data, error } = await supabase
    .from("report_definitions")
    .select(REPORT_DEFINITION_COLUMNS)
    .eq("owner_id", ownerId)
    .eq("enabled", true)
    .not("schedule_rrule", "is", null)
    .lte("next_run_at", now.toISOString());
  if (error) throw error;
  return data.map(mapReportDefinition);
}

/** Recalcula `next_run_at` depois de disparar (6.4, `schedule_reports`) — `null` quando a RRULE não tem mais ocorrências. */
export async function updateReportDefinitionNextRun(supabase: Client, id: string, nextRunAt: string | null): Promise<void> {
  const { error } = await supabase.from("report_definitions").update({ next_run_at: nextRunAt }).eq("id", id);
  if (error) throw error;
}

/** Cria uma definição (6.3: salvar um relatório personalizado; 6.4: também usada pelos prontos com agendamento). `deliverTo.contactIds` vira a chave `contacts` da coluna (nome já fixado pela migration). `timezone` é o fuso do dono no momento da criação (`user_settings.timezone`) — usado pra calcular `next_run_at`. */
export async function createReportDefinition(supabase: Client, ownerId: string, input: ReportDefinitionInput): Promise<string> {
  const timezone = await getUserTimezone(supabase, ownerId);
  const nextRunAt = input.scheduleRrule ? nextOccurrence(input.scheduleRrule, timezone, new Date()) : null;

  const { data, error } = await supabase
    .from("report_definitions")
    .insert({
      owner_id: ownerId,
      name: input.name,
      kind: input.kind,
      params: input.params as unknown as Json,
      schedule_rrule: input.scheduleRrule,
      timezone,
      next_run_at: nextRunAt?.toISOString() ?? null,
      deliver_to: { me: input.deliverTo.me, contacts: input.deliverTo.contactIds } as unknown as Json,
      channels: input.channels,
      include_ai_summary: input.includeAiSummary,
      enabled: input.enabled,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateReportDefinition(supabase: Client, ownerId: string, id: string, input: ReportDefinitionInput): Promise<void> {
  const timezone = await getUserTimezone(supabase, ownerId);
  const nextRunAt = input.scheduleRrule ? nextOccurrence(input.scheduleRrule, timezone, new Date()) : null;

  const { error } = await supabase
    .from("report_definitions")
    .update({
      name: input.name,
      kind: input.kind,
      params: input.params as unknown as Json,
      schedule_rrule: input.scheduleRrule,
      next_run_at: nextRunAt?.toISOString() ?? null,
      deliver_to: { me: input.deliverTo.me, contacts: input.deliverTo.contactIds } as unknown as Json,
      channels: input.channels,
      include_ai_summary: input.includeAiSummary,
      enabled: input.enabled,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteReportDefinition(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from("report_definitions").delete().eq("id", id);
  if (error) throw error;
}

/** Agenda o job `schedule_reports` (6.4, a cada 15 min) pro dono, se ainda não existir — mesmo padrão "garante na primeira visita de verdade" do `check_reviews_due` (5.7, `ensureReviewPushSchedule`), chamado a partir de `/relatorios`. */
export async function ensureReportScheduleJob(supabase: Client, ownerId: string): Promise<void> {
  await supabase.from("job_schedules").upsert({ kind: "schedule_reports", owner_id: ownerId, interval_seconds: 15 * 60, enabled: true }, { onConflict: "kind" });
}
