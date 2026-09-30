import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { parseRoutineBlocks, sortBlocks, type RoutineBlock } from "./lib/routine-blocks";

/** Blocos fixos da Rotina (10.2), de `user_settings.preferences.routineBlocks`. */
export async function listRoutineBlocks(supabase: SupabaseClient<Database>, ownerId: string): Promise<RoutineBlock[]> {
  const { data } = await supabase.from("user_settings").select("preferences").eq("owner_id", ownerId).maybeSingle();
  const preferences = (data?.preferences as Record<string, unknown> | null) ?? {};
  return sortBlocks(parseRoutineBlocks(preferences.routineBlocks));
}
