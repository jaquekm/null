import { WEEKDAYS } from "@/features/habits/lib/habit-week";
import type { WeekPlan } from "@/features/meals/lib/menu-plan";

/**
 * Liga o que a dona escreveu no cardápio à receita com os ingredientes (10.10).
 * Antes tinha que ser o nome exato; agora "Frango  com arroz", "frango com
 * arroz" e "Frângo com arroz" são o mesmo prato.
 */
export function normalizeDishName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function findRecipeForDish<R extends { title: string }>(recipes: R[], text: string): R | null {
  const key = normalizeDishName(text);
  if (!key) return null;
  return recipes.find((r) => normalizeDishName(r.title) === key) ?? null;
}

export interface WeekCoverage {
  /** Pratos diferentes escritos na semana. */
  dishes: number;
  /** Desses, quantos têm receita com ingrediente (entram na lista de compras). */
  withIngredients: number;
  /** Pratos sem ingrediente ainda, como foram escritos (sem repetir). */
  missing: string[];
}

/** Quanto do cardápio da semana já vira lista de compras — pra dizer antes de gerar, não depois. */
export function weekCoverage<R extends { title: string; ingredients: unknown[] }>(plan: WeekPlan, recipes: R[]): WeekCoverage {
  const seen = new Map<string, string>();
  for (const day of WEEKDAYS) {
    for (const text of Object.values(plan[day] ?? {})) {
      if (typeof text !== "string" || !text.trim()) continue;
      const key = normalizeDishName(text);
      if (!seen.has(key)) seen.set(key, text.trim());
    }
  }
  const missing: string[] = [];
  let withIngredients = 0;
  for (const text of seen.values()) {
    const recipe = findRecipeForDish(recipes, text);
    if (recipe && recipe.ingredients.length > 0) withIngredients += 1;
    else missing.push(text);
  }
  return { dishes: seen.size, withIngredients, missing };
}
