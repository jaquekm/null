/**
 * Ingredientes de receita (10.10): `properties.ingredients` (array de
 * `{name, qty, unit}`), fora do editor genérico de campos — não existe tipo
 * de campo "lista de linhas estruturadas", e a lista de compras precisa
 * somar por nome+unidade, não só mostrar texto.
 */
export interface Ingredient {
  name: string;
  qty: number;
  unit: string;
}

const LINE_PATTERN = /^(\d+(?:[.,]\d+)?)\s*([a-zà-úçã%]+)\s+(.+)$/i;

/** Uma linha por ingrediente, "200 g arroz" / "2 unid ovo" — linha que não casa o padrão é ignorada (digitada errado). */
export function parseIngredientsText(text: string): Ingredient[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const match = LINE_PATTERN.exec(line);
      if (!match) return [];
      return [{ qty: Number(match[1]!.replace(",", ".")), unit: match[2]!.toLowerCase(), name: match[3]!.trim() }];
    });
}

/** Volta pro formato de texto editável — mesmo formato que `parseIngredientsText` lê. */
export function formatIngredientsText(ingredients: Ingredient[]): string {
  return ingredients.map((i) => `${formatQty(i.qty)} ${i.unit} ${i.name}`).join("\n");
}

function roundQty(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatQty(value: number): string {
  return String(roundQty(value)).replace(".", ",");
}

/** "Ajustar pra N pessoas" (10.10) — escala cada ingrediente proporcionalmente; `fromServings` inválido devolve a lista como está. */
export function scaleIngredients(ingredients: Ingredient[], fromServings: number, toServings: number): Ingredient[] {
  if (fromServings <= 0 || toServings <= 0) return ingredients;
  const factor = toServings / fromServings;
  return ingredients.map((i) => ({ ...i, qty: roundQty(i.qty * factor) }));
}

/** Soma ingredientes repetidos (mesmo nome+unidade, sem diferenciar maiúsculas) de várias receitas — pra lista de compras do cardápio. */
export function sumIngredients(lists: Ingredient[][]): Ingredient[] {
  const byKey = new Map<string, Ingredient>();
  for (const list of lists) {
    for (const ingredient of list) {
      const key = `${ingredient.name.trim().toLowerCase()}|${ingredient.unit.trim().toLowerCase()}`;
      const existing = byKey.get(key);
      if (existing) existing.qty = roundQty(existing.qty + ingredient.qty);
      else byKey.set(key, { ...ingredient, qty: roundQty(ingredient.qty) });
    }
  }
  return [...byKey.values()];
}
