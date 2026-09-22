import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/** A automação já rodou pra este item nesta cadeia (`chainId`)? Proteção contra laço/repetição (5.3). */
export async function hasAlreadyRun(supabase: Client, ownerId: string, itemId: string, automationId: string, chainId: string): Promise<boolean> {
  const { data } = await supabase
    .from("automation_event_log")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("item_id", itemId)
    .eq("automation_id", automationId)
    .eq("chain_id", chainId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function markRan(supabase: Client, ownerId: string, itemId: string, automationId: string, chainId: string): Promise<void> {
  await supabase.from("automation_event_log").insert({ owner_id: ownerId, item_id: itemId, automation_id: automationId, chain_id: chainId });
}
