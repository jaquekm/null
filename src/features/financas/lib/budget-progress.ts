import type { Cents } from "@/lib/money";

export type BudgetStatus = "under" | "warning" | "over";

export interface ExpenseForBudget {
  categoryId: string | null;
  amountCents: Cents;
}

/** Soma o gasto (saídas, `amountCents < 0`) por categoria — sem categoria ou entrada não entra no orçamento. */
export function sumExpensesByCategory(transactions: ExpenseForBudget[]): Map<string, Cents> {
  const result = new Map<string, Cents>();
  for (const t of transactions) {
    if (!t.categoryId || t.amountCents >= 0) continue;
    result.set(t.categoryId, (result.get(t.categoryId) ?? 0) + Math.abs(t.amountCents));
  }
  return result;
}

/** 0–80% verde, 80–100% amarelo, >100% vermelho (4.11). */
export function budgetStatus(percent: number): BudgetStatus {
  if (percent > 100) return "over";
  if (percent >= 80) return "warning";
  return "under";
}

export interface CategoryBudgetProgress {
  categoryId: string;
  spentCents: Cents;
  budgetCents: Cents | null;
  /** `null` quando a categoria não tem orçamento definido (nada pra comparar). */
  percent: number | null;
  status: BudgetStatus | null;
}

/** Junta gasto do mês com o orçamento de cada categoria — sem orçamento, mostra só o gasto (percent/status `null`). */
export function computeCategoryBudgetProgress(
  categories: { id: string; budgetCents: Cents | null }[],
  spentByCategory: Map<string, Cents>,
): CategoryBudgetProgress[] {
  return categories.map((category) => {
    const spentCents = spentByCategory.get(category.id) ?? 0;
    if (category.budgetCents == null || category.budgetCents <= 0) {
      return { categoryId: category.id, spentCents, budgetCents: category.budgetCents, percent: null, status: null };
    }
    const percent = (spentCents / category.budgetCents) * 100;
    return { categoryId: category.id, spentCents, budgetCents: category.budgetCents, percent, status: budgetStatus(percent) };
  });
}

/** Quais limites esse percentual atinge (80/100) — pro job de alerta decidir o que ainda não notificou nesse mês (4.11). */
export function thresholdsReached(percent: number): (80 | 100)[] {
  const thresholds: (80 | 100)[] = [];
  if (percent >= 80) thresholds.push(80);
  if (percent >= 100) thresholds.push(100);
  return thresholds;
}
