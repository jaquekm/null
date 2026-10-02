import { describe, expect, it } from "vitest";
import { buildPayoffPlan, orderDebts, type Debt } from "./payoff-plan";

function debt(id: string, balanceCents: number, monthlyRatePercent: number): Debt {
  return { id, name: id, balanceCents, monthlyRatePercent };
}

describe("orderDebts", () => {
  const debts = [debt("a", 5_000, 1), debt("b", 1_000, 5), debt("c", 3_000, 3)];

  it("\"menor_saldo\": menor saldo primeiro", () => {
    expect(orderDebts(debts, "menor_saldo").map((d) => d.id)).toEqual(["b", "c", "a"]);
  });

  it("\"maior_juro\": maior juro primeiro", () => {
    expect(orderDebts(debts, "maior_juro").map((d) => d.id)).toEqual(["b", "c", "a"]);
  });

  it("não muda o array original", () => {
    const copy = [...debts];
    orderDebts(debts, "menor_saldo");
    expect(debts).toEqual(copy);
  });
});

describe("buildPayoffPlan", () => {
  it("sem dívidas, plano vazio", () => {
    expect(buildPayoffPlan([], 1_000, "menor_saldo")).toEqual([]);
  });

  it("paga uma dívida por vez, na ordem, sem juros", () => {
    const plan = buildPayoffPlan([debt("a", 1_000, 0), debt("b", 2_000, 0)], 1_000, "menor_saldo");
    expect(plan).toEqual([
      { id: "a", name: "a", order: 1, monthsToPayoff: 1 },
      { id: "b", name: "b", order: 2, monthsToPayoff: 3 },
    ]);
  });

  it("sobra do orçamento no mesmo mês já rola pra próxima dívida", () => {
    const plan = buildPayoffPlan([debt("a", 500, 0), debt("b", 1_000, 0)], 1_000, "menor_saldo");
    expect(plan).toEqual([
      { id: "a", name: "a", order: 1, monthsToPayoff: 1 },
      { id: "b", name: "b", order: 2, monthsToPayoff: 2 },
    ]);
  });

  it("juros incidem mesmo na dívida que ainda não chegou sua vez", () => {
    // "b" (maior saldo) não recebe nada no mês 1, mas o saldo cresce com os juros.
    const plan = buildPayoffPlan([debt("a", 100, 0), debt("b", 1_000, 10)], 100, "menor_saldo");
    expect(plan[0]).toEqual({ id: "a", name: "a", order: 1, monthsToPayoff: 1 });
    // 1000 * 1.10 = 1100 depois do mês 1 (sem pagamento nenhum ainda).
    expect(plan[1]!.monthsToPayoff).not.toBe(1);
  });

  it("orçamento que não cobre os juros nunca quita (null)", () => {
    const plan = buildPayoffPlan([debt("a", 100_000, 50)], 1, "menor_saldo");
    expect(plan).toEqual([{ id: "a", name: "a", order: 1, monthsToPayoff: null }]);
  });

  it("ordena por \"maior_juro\" quando pedido", () => {
    const plan = buildPayoffPlan([debt("a", 1_000, 1), debt("b", 1_000, 5)], 1_000, "maior_juro");
    expect(plan.map((p) => p.id)).toEqual(["b", "a"]);
  });
});
