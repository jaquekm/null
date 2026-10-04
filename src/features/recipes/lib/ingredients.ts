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

/** Unidades reconhecidas depois do número; outra palavra ali já é o nome ("2 ovos" = 2 un ovos). */
const UNITS = new Set([
  "g", "kg", "mg", "ml", "l", "lt", "litro", "litros",
  "xic", "xíc", "xicara", "xícara", "xicaras", "xícaras",
  "colher", "colheres", "col", "cs", "cc",
  "un", "und", "unid", "unidade", "unidades",
  "dente", "dentes", "pitada", "pitadas", "maço", "maços", "lata", "latas", "pacote", "pacotes", "pct",
  "fatia", "fatias", "copo", "copos", "pote", "potes", "folha", "folhas", "ramo", "ramos", "cabeça", "cabeças", "caixa", "caixas", "bandeja", "bandejas",
]);

const LEADING_NUMBER = /^(\d+\/\d+|\d+(?:[.,]\d+)?)\s*(.*)$/;

function parseQty(raw: string): number {
  if (raw.includes("/")) {
    const [n, d] = raw.split("/").map(Number);
    return d ? roundQty(n! / d) : 0;
  }
  return Number(raw.replace(",", "."));
}

/**
 * Uma linha por ingrediente. Aceita do jeito que se escreve:
 * "200 g arroz", "2 xícaras de farinha", "2 ovos" (vira 2 un), "1/2 cebola",
 * e linha sem número ("sal a gosto") — entra só com o nome, sem quantidade.
 */
export function parseIngredientsText(text: string): Ingredient[] {
  return text
    .split("\n")
    .map((line) => line.trim().replace(/^[-•*]\s*/, ""))
    .filter(Boolean)
    .map((line) => {
      const match = LEADING_NUMBER.exec(line);
      if (!match || !match[2]) return { qty: 0, unit: "", name: line };
      const qty = parseQty(match[1]!);
      const [first = "", ...rest] = match[2].split(/\s+/);
      const unitCandidate = first.toLowerCase().replace(/\.$/, "");
      if (UNITS.has(unitCandidate) && rest.length > 0) {
        return { qty, unit: unitCandidate, name: rest.join(" ").replace(/^de\s+/i, "") };
      }
      return { qty, unit: "un", name: match[2] };
    });
}

/** Um ingrediente como se lê: "200 g arroz", "2 ovos", "sal a gosto". */
export function formatIngredient(i: Ingredient): string {
  if (!i.qty) return i.name;
  if (i.unit === "un" || !i.unit) return `${formatQty(i.qty)} ${i.name}`;
  return `${formatQty(i.qty)} ${i.unit} ${i.name}`;
}

/** Volta pro formato de texto editável — mesmo formato que `parseIngredientsText` lê. */
export function formatIngredientsText(ingredients: Ingredient[]): string {
  return ingredients.map(formatIngredient).join("\n");
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
