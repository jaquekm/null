import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { summarizeFocusSessions, type FocusSummary } from "./lib/focus-summary";

type Client = SupabaseClient<Database>;

/**
 * "Onde foi meu tempo" (10.3, aba Foco de `/rotina`) — sessões de foco entre
 * `weekStartIso` (inclusive) e `weekEndIso` (exclusive), agrupadas por item.
 * Duas consultas (sessões, depois títulos dos itens envolvidos) em vez de um
 * embed do PostgREST — `item_id` é opcional (`on delete set null`), então um
 * embed indireto complicaria a tipagem à mão do `database.types.ts` sem
 * ganho real aqui (poucas linhas por semana).
 */
export async function getFocusSummaryForWeek(supabase: Client, ownerId: string, weekStartIso: string, weekEndIso: string): Promise<FocusSummary> {
  const { data, error } = await supabase
    .from("focus_sessions")
    .select("item_id, duration_minutes")
    .eq("owner_id", ownerId)
    .gte("started_at", weekStartIso)
    .lt("started_at", weekEndIso);
  if (error) throw error;

  const itemIds = [...new Set(data.map((row) => row.item_id).filter((id): id is string => id !== null))];
  const { data: items } =
    itemIds.length > 0 ? await supabase.from("items").select("id, title").in("id", itemIds) : { data: [] as { id: string; title: string }[] };
  const titleById = new Map((items ?? []).map((item) => [item.id, item.title]));

  return summarizeFocusSessions(
    data.map((row) => ({
      itemId: row.item_id,
      itemTitle: row.item_id ? titleById.get(row.item_id) ?? null : null,
      durationMinutes: row.duration_minutes,
    })),
  );
}
