import type { Weekday } from "@/features/habits/lib/habit-week";
import type { MealKey } from "./meal-slots";

export type DayPlan = Partial<Record<MealKey, string>>;
export type WeekPlan = Partial<Record<Weekday, DayPlan>>;

export function emptyWeekPlan(): WeekPlan {
  return {};
}

/** Uma célula do cardápio (10.9) — texto vazio remove a chave em vez de guardar "". */
export function setPlanCell(plan: WeekPlan, day: Weekday, mealKey: MealKey, text: string): WeekPlan {
  const trimmed = text.trim();
  const dayPlan = { ...(plan[day] ?? {}) };
  if (trimmed) dayPlan[mealKey] = trimmed;
  else delete dayPlan[mealKey];
  return { ...plan, [day]: dayPlan };
}

/** "Copiar dia" (10.9) — substitui o dia de destino pelo do dia de origem (perde o que tinha antes no destino). */
export function copyDay(plan: WeekPlan, from: Weekday, to: Weekday): WeekPlan {
  if (from === to) return plan;
  return { ...plan, [to]: { ...(plan[from] ?? {}) } };
}
