import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface PushSubscriptionRow {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Dispositivos com notificações ativadas (3.9, `/configuracoes/notificacoes`). */
export async function listPushSubscriptions(supabase: Client): Promise<PushSubscriptionRow[]> {
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id, user_agent, created_at, last_used_at")
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}
