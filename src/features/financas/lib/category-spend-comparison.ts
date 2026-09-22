import type { Cents } from "@/lib/money";

export interface CategorySpendComparison {
  categoryId: string;
  categoryName: string;
  currentCents: Cents;
  previousCents: Cents;
  deltaCents: Cents;
}

/**
 * "Gastos por categoria no mês... com comparação ao mês anterior" (4.12).
 * Recebe os dois mapas já prontos (`sumExpensesByCategory`, 4.11) pra não
 * duplicar a regra de "o que conta como gasto" — só junta com o nome da
 * categoria e ordena. Categoria sem gasto nos dois meses não aparece (nada
 * pra comparar); maior gasto do mês atual primeiro.
 */
export function compareCategorySpend(
  categories: { id: string; name: string }[],
  currentSpend: Map<string, Cents>,
  previousSpend: Map<string, Cents>,
): CategorySpendComparison[] {
  return categories
    .map((category) => {
      const currentCents = currentSpend.get(category.id) ?? 0;
      const previousCents = previousSpend.get(category.id) ?? 0;
      return { categoryId: category.id, categoryName: category.name, currentCents, previousCents, deltaCents: currentCents - previousCents };
    })
    .filter((row) => row.currentCents > 0 || row.previousCents > 0)
    .sort((a, b) => b.currentCents - a.currentCents);
}
