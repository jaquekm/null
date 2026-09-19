import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { UsageEventRow } from "./lib/aggregate-usage";

type Client = SupabaseClient<Database>;

export async function listUsageEventsSince(supabase: Client, since: Date): Promise<UsageEventRow[]> {
  const { data, error } = await supabase
    .from("usage_events")
    .select("provider, feature, cost_usd, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;

  return data.map((row) => ({
    provider: row.provider,
    feature: row.feature,
    costUsd: row.cost_usd,
    createdAt: row.created_at,
  }));
}
