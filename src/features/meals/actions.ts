"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { getUserTimezone } from "@/features/agenda/queries";
import { requireOwner } from "@/lib/auth";
import { todayInTimezone } from "@/lib/dates";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import type { MealsState } from "./lib/meal-slots";
import { copyDay, setPlanCell, type WeekPlan } from "./lib/menu-plan";
import { getWeekPlan } from "./queries";
import { copyPlanDaySchema, repeatWeekSchema, setMealPlanCellSchema, toggleMealSchema } from "./schemas";

const PATH = "/cardapio";

/** Marcar/desmarcar uma refeição de hoje (10.8) — uma linha por dia em `meal_logs`, como a Água (10.4). */
export async function toggleMeal(input: z.input<typeof toggleMealSchema>): Promise<Result<MealsState>> {
  const parsed = toggleMealSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { supabase, user } = await requireOwner();

  const timezone = await getUserTimezone(supabase, user.id);
  const day = todayInTimezone(timezone);

  const { data: current } = await supabase.from("meal_logs").select("meals").eq("owner_id", user.id).eq("day", day).maybeSingle();
  const meals = (current?.meals as MealsState | null) ?? {};
  const nextMeals: MealsState = { ...meals, [parsed.data.mealKey]: !meals[parsed.data.mealKey] };

  const { error } = await supabase.from("meal_logs").upsert({ owner_id: user.id, day, meals: nextMeals as unknown as Json }, { onConflict: "owner_id,day" });
  if (error) return fail("Não foi possível salvar. Tente de novo.");

  revalidatePath("/hoje");
  return ok(nextMeals);
}

async function savePlan(ownerId: string, weekStart: string, plan: WeekPlan): Promise<boolean> {
  const { supabase } = await requireOwner();
  const { error } = await supabase
    .from("meal_plans")
    .upsert({ owner_id: ownerId, week_start: weekStart, plan: plan as unknown as Json }, { onConflict: "owner_id,week_start" });
  return !error;
}

/** Uma célula do cardápio (10.9) — texto em branco apaga a célula. */
export async function setMealPlanCell(input: z.input<typeof setMealPlanCellSchema>): Promise<Result<WeekPlan>> {
  const parsed = setMealPlanCellSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { supabase, user } = await requireOwner();

  const current = await getWeekPlan(supabase, user.id, parsed.data.weekStart);
  const next = setPlanCell(current, parsed.data.day, parsed.data.mealKey, parsed.data.text);
  if (!(await savePlan(user.id, parsed.data.weekStart, next))) return fail("Não foi possível salvar. Tente de novo.");

  revalidatePath(PATH);
  return ok(next);
}

/** "Copiar dia" (10.9) — substitui o dia de destino pelo de origem, na mesma semana. */
export async function copyPlanDay(input: z.input<typeof copyPlanDaySchema>): Promise<Result<WeekPlan>> {
  const parsed = copyPlanDaySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { supabase, user } = await requireOwner();

  const current = await getWeekPlan(supabase, user.id, parsed.data.weekStart);
  const next = copyDay(current, parsed.data.from, parsed.data.to);
  if (!(await savePlan(user.id, parsed.data.weekStart, next))) return fail("Não foi possível salvar. Tente de novo.");

  revalidatePath(PATH);
  return ok(next);
}

/** "Repetir esta semana" (10.9) — copia a semana inteira pra outra (substitui o que já tinha lá). */
export async function repeatWeek(input: z.input<typeof repeatWeekSchema>): Promise<Result<null>> {
  const parsed = repeatWeekSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { supabase, user } = await requireOwner();

  const fromPlan = await getWeekPlan(supabase, user.id, parsed.data.fromWeekStart);
  if (!(await savePlan(user.id, parsed.data.toWeekStart, fromPlan))) return fail("Não foi possível salvar. Tente de novo.");

  revalidatePath(PATH);
  return ok(null);
}
