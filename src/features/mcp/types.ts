import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type AdminClient = SupabaseClient<Database>;

/**
 * Contexto comum a toda ferramenta MCP (6.9) — cliente admin (sem sessão,
 * `verifyApiTokenAnyScope` já validou o token) e o dono/fuso já resolvidos.
 */
export interface McpContext {
  admin: AdminClient;
  ownerId: string;
  timezone: string;
}

export class McpToolError extends Error {}
