import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { addDaysToDateString } from "@/lib/dates";
import { fillWaterHistory, type WaterDayTotal } from "./lib/water-progress";

type Client = SupabaseClient<Database>;

const DEFAULT_GOAL_ML = 2000;
const HISTORY_DAYS = 7;

export interface WaterData {
  goalMl: number;
  todayMl: number;
  /** Últimos `HISTORY_DAYS` dias, do mais antigo pro de hoje (inclusive). */
  history: WaterDayTotal[];
}

/** Card de Água no Hoje (10.4): meta (preferência da dona, com padrão de 2L), total de hoje e histórico da semana. */
export async function getWaterData(supabase: Client, ownerId: string, today: string): Promise<WaterData> {
  const startDay = addDaysToDateString(today, -(HISTORY_DAYS - 1));

  const [settingsResult, logsResult] = await Promise.all([
    supabase.from("user_settings").select("preferences").eq("owner_id", ownerId).maybeSingle(),
    supabase.from("water_logs").select("day, total_ml").eq("owner_id", ownerId).gte("day", startDay).lte("day", today),
  ]);

  const preferences = (settingsResult.data?.preferences as { waterGoalMl?: number } | null) ?? {};
  const goalMl = typeof preferences.waterGoalMl === "number" && preferences.waterGoalMl > 0 ? preferences.waterGoalMl : DEFAULT_GOAL_ML;

  const history = fillWaterHistory((logsResult.data ?? []).map((row) => ({ day: row.day, totalMl: row.total_ml })), HISTORY_DAYS, today);
  const todayMl = history.at(-1)?.totalMl ?? 0;

  return { goalMl, todayMl, history };
}
