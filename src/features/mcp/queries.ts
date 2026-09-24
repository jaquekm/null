import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface McpAuditRow {
  id: number;
  tool: string;
  status: string;
  resultSummary: string | null;
  durationMs: number | null;
  tokenName: string | null;
  createdAt: string;
}

/** Últimas chamadas ao servidor MCP (6.9, `/configuracoes/mcp`). */
export async function listMcpAuditLog(supabase: Client, limit = 50): Promise<McpAuditRow[]> {
  const { data, error } = await supabase
    .from("mcp_audit")
    .select("id, tool, status, result_summary, duration_ms, created_at, api_tokens(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    tool: row.tool,
    status: row.status,
    resultSummary: row.result_summary,
    durationMs: row.duration_ms,
    tokenName: row.api_tokens?.name ?? null,
    createdAt: row.created_at,
  }));
}

/** Agenda o job `check_mcp_token_expiry` (6.9, diário) pro dono, se ainda não existir — mesmo padrão "garante na primeira visita de verdade" de `ensureReportScheduleJob` (6.4), chamado a partir de `/configuracoes/mcp`. */
export async function ensureMcpTokenExpiryCheckSchedule(supabase: Client, ownerId: string): Promise<void> {
  await supabase.from("job_schedules").upsert({ kind: "check_mcp_token_expiry", owner_id: ownerId, interval_seconds: 24 * 60 * 60, enabled: true }, { onConflict: "kind" });
}
