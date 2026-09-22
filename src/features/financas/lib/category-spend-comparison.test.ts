import { describe, expect, it } from "vitest";
import { compareCategorySpend } from "./category-spend-comparison";

const CATEGORIES = [
  { id: "a", name: "Mercado" },
  { id: "b", name: "Lazer" },
  { id: "c", name: "Saúde" },
];

describe("compareCategorySpend", () => {
  it("junta gasto atual e anterior por categoria, calcula a diferença", () => {
    const result = compareCategorySpend(
      CATEGORIES,
      new Map([
        ["a", 50000],
        ["b", 10000],
      ]),
      new Map([
        ["a", 40000],
        ["b", 15000],
      ]),
    );
    expect(result).toContainEqual({ categoryId: "a", categoryName: "Mercado", currentCents: 50000, previousCents: 40000, deltaCents: 10000 });
    expect(result).toContainEqual({ categoryId: "b", categoryName: "Lazer", currentCents: 10000, previousCents: 15000, deltaCents: -5000 });
  });

  it("categoria sem gasto em nenhum dos dois meses não aparece", () => {
    const result = compareCategorySpend(CATEGORIES, new Map([["a", 1000]]), new Map());
    expect(result.map((r) => r.categoryId)).toEqual(["a"]);
  });

  it("categoria só com gasto no mês anterior ainda aparece (queda pra zero é informação relevante)", () => {
    const result = compareCategorySpend(CATEGORIES, new Map(), new Map([["a", 5000]]));
    expect(result).toEqual([{ categoryId: "a", categoryName: "Mercado", currentCents: 0, previousCents: 5000, deltaCents: -5000 }]);
  });

  it("ordena do maior gasto atual pro menor", () => {
    const result = compareCategorySpend(
      CATEGORIES,
      new Map([
        ["a", 1000],
        ["b", 9000],
        ["c", 5000],
      ]),
      new Map(),
    );
    expect(result.map((r) => r.categoryId)).toEqual(["b", "c", "a"]);
  });

  it("sem categorias ou sem gasto algum: vazio", () => {
    expect(compareCategorySpend([], new Map(), new Map())).toEqual([]);
    expect(compareCategorySpend(CATEGORIES, new Map(), new Map())).toEqual([]);
  });
});
