/**
 * Refeições, 5 horários fixos (não configuráveis) — mesma lista do cardápio
 * da semana (10.9: "café, almoço, lanche, janta, ceia"). No Hoje (10.8) é só
 * "comi ou não"; no cardápio (10.9) cada um ganha o que vai comer.
 */
export const MEAL_SLOTS = [
  { key: "cafe", label: "Café da manhã" },
  { key: "almoco", label: "Almoço" },
  { key: "lanche", label: "Lanche" },
  { key: "jantar", label: "Jantar" },
  { key: "ceia", label: "Ceia" },
] as const;

export type MealKey = (typeof MEAL_SLOTS)[number]["key"];
export const MEAL_KEYS = MEAL_SLOTS.map((slot) => slot.key) as [MealKey, ...MealKey[]];

export type MealsState = Partial<Record<MealKey, boolean>>;

export interface MealsProgress {
  done: number;
  total: number;
}

export function mealsProgress(meals: MealsState): MealsProgress {
  return { done: MEAL_KEYS.filter((key) => meals[key] === true).length, total: MEAL_KEYS.length };
}
