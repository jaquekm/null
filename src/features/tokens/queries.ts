import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface ApiTokenRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export async function listApiTokens(supabase: Client): Promise<ApiTokenRow[]> {
  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, name, token_prefix, scopes, last_used_at, expires_at, revoked_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    prefix: row.token_prefix,
    scopes: row.scopes,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }));
}
