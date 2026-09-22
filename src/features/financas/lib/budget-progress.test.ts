import { describe, expect, it } from "vitest";
import { budgetStatus, computeCategoryBudgetProgress, sumExpensesByCategory, thresholdsReached } from "./budget-progress";

describe("sumExpensesByCategory", () => {
  it("soma só as saídas (amountCents negativo) por categoria", () => {
    const result = sumExpensesByCategory([
      { categoryId: "a", amountCents: -1000 },
      { categoryId: "a", amountCents: -500 },
      { categoryId: "b", amountCents: -300 },
    ]);
    expect(result.get("a")).toBe(1500);
    expect(result.get("b")).toBe(300);
  });

  it("ignora entradas (amountCents positivo) e zero", () => {
    const result = sumExpensesByCategory([
      { categoryId: "a", amountCents: 1000 },
      { categoryId: "a", amountCents: 0 },
    ]);
    expect(result.has("a")).toBe(false);
  });

  it("ignora lançamentos sem categoria", () => {
    const result = sumExpensesByCategory([{ categoryId: null, amountCents: -1000 }]);
    expect(result.size).toBe(0);
  });
});

describe("budgetStatus", () => {
  it("0–80% (exclusive) é 'under'", () => {
    expect(budgetStatus(0)).toBe("under");
    expect(budgetStatus(50)).toBe("under");
    expect(budgetStatus(79.99)).toBe("under");
  });

  it("80–100% (inclusive dos dois lados) é 'warning'", () => {
    expect(budgetStatus(80)).toBe("warning");
    expect(budgetStatus(95)).toBe("warning");
    expect(budgetStatus(100)).toBe("warning");
  });

  it(">100% é 'over'", () => {
    expect(budgetStatus(100.01)).toBe("over");
    expect(budgetStatus(150)).toBe("over");
  });
});

describe("thresholdsReached", () => {
  it("abaixo de 80%: nenhum limite", () => {
    expect(thresholdsReached(79.99)).toEqual([]);
  });

  it("80% a 99,99%: só o de 80", () => {
    expect(thresholdsReached(80)).toEqual([80]);
    expect(thresholdsReached(99.99)).toEqual([80]);
  });

  it("100% ou mais: os dois", () => {
    expect(thresholdsReached(100)).toEqual([80, 100]);
    expect(thresholdsReached(150)).toEqual([80, 100]);
  });
});

describe("computeCategoryBudgetProgress", () => {
  it("categoria sem orçamento: percent/status nulos, mas mostra o gasto", () => {
    const [progress] = computeCategoryBudgetProgress([{ id: "a", budgetCents: null }], new Map([["a", 5000]]));
    expect(progress).toEqual({ categoryId: "a", spentCents: 5000, budgetCents: null, percent: null, status: null });
  });

  it("orçamento zero ou negativo é tratado como sem orçamento", () => {
    const progress = computeCategoryBudgetProgress([{ id: "a", budgetCents: 0 }], new Map([["a", 100]]))[0]!;
    expect(progress.percent).toBeNull();
    expect(progress.status).toBeNull();
  });

  it("calcula percent e status corretamente com orçamento definido", () => {
    const progress = computeCategoryBudgetProgress([{ id: "a", budgetCents: 10000 }], new Map([["a", 8500]]))[0]!;
    expect(progress.spentCents).toBe(8500);
    expect(progress.percent).toBeCloseTo(85);
    expect(progress.status).toBe("warning");
  });

  it("categoria sem gasto no mapa: spentCents = 0", () => {
    const progress = computeCategoryBudgetProgress([{ id: "a", budgetCents: 10000 }], new Map())[0]!;
    expect(progress.spentCents).toBe(0);
    expect(progress.percent).toBe(0);
    expect(progress.status).toBe("under");
  });

  it("preserva a ordem e mapeia várias categorias de uma vez", () => {
    const progress = computeCategoryBudgetProgress(
      [
        { id: "a", budgetCents: 10000 },
        { id: "b", budgetCents: 5000 },
      ],
      new Map([
        ["a", 12000],
        ["b", 1000],
      ]),
    );
    expect(progress.map((p) => p.categoryId)).toEqual(["a", "b"]);
    expect(progress[0]!.status).toBe("over");
    expect(progress[1]!.status).toBe("under");
  });
});
