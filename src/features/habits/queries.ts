import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dateInTimezone } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";
import type { HabitLog } from "./lib/habit-log";
import type { HabitForWeek } from "./lib/habit-week";

type Client = SupabaseClient<Database>;

export interface RotinaHabits {
  /** Existe o tipo Hábito? Sem ele, a página oferece criar. */
  hasHabitType: boolean;
  habits: HabitForWeek[];
}

/**
 * Hábitos da Rotina (10.1): itens ativos do tipo Hábito (5.12, pack "Diário e
 * hábitos"), de qualquer espaço. `since` é o dia em que o hábito começou (a
 * criação, ou o registro mais antigo, se a dona marcou dias anteriores).
 */
export async function listRotinaHabits(supabase: Client, timezone: string): Promise<RotinaHabits> {
  const { data: types } = await supabase.from("object_types").select("id").eq("slug", "habito").is("archived_at", null);
  const typeIds = (types ?? []).map((t) => t.id);
  if (typeIds.length === 0) return { hasHabitType: false, habits: [] };

  const { data: items } = await supabase
    .from("items")
    .select("id, title, properties, created_at")
    .in("type_id", typeIds)
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("created_at", { ascending: true });

  const habits = (items ?? []).map((row) => {
    const properties = (row.properties as Record<string, unknown> | null) ?? {};
    const log = (properties.log as HabitLog | undefined) ?? {};
    const created = dateInTimezone(new Date(row.created_at), timezone);
    const earliestLog = Object.keys(log).filter((d) => log[d]).sort()[0];
    return {
      id: row.id,
      title: row.title || "Sem nome",
      log,
      frequency: properties.frequency ?? null,
      since: earliestLog && earliestLog < created ? earliestLog : created,
    };
  });
  return { hasHabitType: true, habits };
}
