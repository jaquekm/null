import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type McpAuditStatus = "ok" | "denied" | "error";

export interface McpAuditEntry {
  ownerId: string;
  tokenId: string;
  tool: string;
  /** Argumentos da chamada — gravados como vieram do cliente MCP, sem segredos (nenhuma ferramenta aceita senha/token como argumento). */
  args: unknown;
  resultSummary: string;
  status: McpAuditStatus;
  durationMs: number;
}

/** Registra toda chamada MCP (6.9: "Toda chamada gravada em mcp_audit") — melhor esforço, uma falha ao gravar não deve derrubar a resposta da ferramenta. */
export async function logMcpCall(admin: Client, entry: McpAuditEntry): Promise<void> {
  try {
    await admin.from("mcp_audit").insert({
      owner_id: entry.ownerId,
      token_id: entry.tokenId,
      tool: entry.tool,
      arguments: entry.args as unknown as Json,
      result_summary: entry.resultSummary.slice(0, 2000),
      status: entry.status,
      duration_ms: Math.round(entry.durationMs),
    });
  } catch {
    // melhor esforço — ver comentário acima
  }
}
