import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import type { ReportKind } from "./schemas";
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
