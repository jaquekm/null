import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { MealsState } from "./lib/meal-slots";
import type { WeekPlan } from "./lib/menu-plan";

type Client = SupabaseClient<Database>;

/** Refeições marcadas hoje (10.8) — `{}` se ainda não tocou em nenhuma. */
export async function getMealsForToday(supabase: Client, ownerId: string, today: string): Promise<MealsState> {
  const { data } = await supabase.from("meal_logs").select("meals").eq("owner_id", ownerId).eq("day", today).maybeSingle();
  return (data?.meals as MealsState | null) ?? {};
}

/** Cardápio de uma semana (10.9) — `{}` se ainda não tem nada planejado. */
export async function getWeekPlan(supabase: Client, ownerId: string, weekStart: string): Promise<WeekPlan> {
  const { data } = await supabase.from("meal_plans").select("plan").eq("owner_id", ownerId).eq("week_start", weekStart).maybeSingle();
  return (data?.plan as WeekPlan | null) ?? {};
}
