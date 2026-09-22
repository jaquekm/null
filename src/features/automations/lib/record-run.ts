import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type RunStatus = "success" | "skipped" | "failed";

/** Grava uma linha de `automation_runs` (5.3: "cada execução grava automation_runs"). */
export async function recordAutomationRun(
  supabase: Client,
  ownerId: string,
  automationId: string,
  itemId: string | null,
  status: RunStatus,
  detail: Record<string, unknown>,
): Promise<void> {
  await supabase.from("automation_runs").insert({
    owner_id: ownerId,
    automation_id: automationId,
    item_id: itemId,
    status,
    detail: detail as unknown as Json,
  });
}
