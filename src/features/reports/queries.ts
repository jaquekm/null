import "server-only";
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
    createdAt: row.created_at,
  };
}

/** Um snapshot específico — tela de relatório e página pública `/p/[token]` (6.4). */
export async function getReportRun(supabase: Client, id: string): Promise<ReportRunRow | null> {
  const { data, error } = await supabase
    .from("report_runs")
    .select("id, definition_id, kind, title, period_start, period_end, data, ai_summary, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapReportRun(data) : null;
}

/** Histórico de execuções, mais recente primeiro — lista da página `/relatorios` (6.4). */
export async function listReportRuns(supabase: Client, limit = 50): Promise<ReportRunRow[]> {
  const { data, error } = await supabase
    .from("report_runs")
    .select("id, definition_id, kind, title, period_start, period_end, data, ai_summary, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map(mapReportRun);
}

export interface ReportDefinitionRow {
  id: string;
  name: string;
  kind: ReportKind;
  params: Record<string, unknown>;
  scheduleRrule: string | null;
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
    deliverTo: { me: deliverTo.me ?? true, contactIds: deliverTo.contacts ?? [] },
    channels: row.channels as ReportChannel[],
    includeAiSummary: row.include_ai_summary,
    enabled: row.enabled,
    createdAt: row.created_at,
  };
}

/** Definições salvas (prontas configuradas ou personalizadas) — lista da página `/relatorios` (6.4) e fila de agendamento (`schedule_reports`, 6.4). */
export async function listReportDefinitions(supabase: Client): Promise<ReportDefinitionRow[]> {
  const { data, error } = await supabase
    .from("report_definitions")
    .select("id, name, kind, params, schedule_rrule, deliver_to, channels, include_ai_summary, enabled, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapReportDefinition);
}

export async function getReportDefinition(supabase: Client, id: string): Promise<ReportDefinitionRow | null> {
  const { data, error } = await supabase
    .from("report_definitions")
    .select("id, name, kind, params, schedule_rrule, deliver_to, channels, include_ai_summary, enabled, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapReportDefinition(data) : null;
}

/** Cria uma definição (6.3: salvar um relatório personalizado; 6.4: também usada pelos prontos com agendamento). `deliverTo.contactIds` vira a chave `contacts` da coluna (nome já fixado pela migration). */
export async function createReportDefinition(supabase: Client, ownerId: string, input: ReportDefinitionInput): Promise<string> {
  const { data, error } = await supabase
    .from("report_definitions")
    .insert({
      owner_id: ownerId,
      name: input.name,
      kind: input.kind,
      params: input.params as unknown as Json,
      schedule_rrule: input.scheduleRrule,
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

export async function updateReportDefinition(supabase: Client, id: string, input: ReportDefinitionInput): Promise<void> {
  const { error } = await supabase
    .from("report_definitions")
    .update({
      name: input.name,
      kind: input.kind,
      params: input.params as unknown as Json,
      schedule_rrule: input.scheduleRrule,
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
