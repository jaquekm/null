import { describe, expect, it } from "vitest";
import { computeTransactionTotals, topExpenses, type TransactionForTopExpenses } from "./transaction-totals";

describe("computeTransactionTotals", () => {
  it("soma entradas e saídas separadamente, resultado é a soma das duas", () => {
    const totals = computeTransactionTotals([
      { amountCents: 500000, kind: "normal" },
      { amountCents: -120000, kind: "normal" },
      { amountCents: -8000, kind: "normal" },
    ]);
    expect(totals).toEqual({ incomeCents: 500000, expenseCents: -128000, resultCents: 372000 });
  });

  it("ignora transferências (kind='transfer')", () => {
    const totals = computeTransactionTotals([
      { amountCents: 500000, kind: "normal" },
      { amountCents: -50000, kind: "transfer" },
      { amountCents: 50000, kind: "transfer" },
    ]);
    expect(totals).toEqual({ incomeCents: 500000, expenseCents: 0, resultCents: 500000 });
  });

  it("ignora pagamento de fatura (kind='card_payment')", () => {
    const totals = computeTransactionTotals([
      { amountCents: -80000, kind: "card_payment" },
      { amountCents: 80000, kind: "card_payment" },
    ]);
    expect(totals).toEqual({ incomeCents: 0, expenseCents: 0, resultCents: 0 });
  });

  it("conta ajustes (kind='adjustment')", () => {
    const totals = computeTransactionTotals([{ amountCents: 1000, kind: "adjustment" }]);
    expect(totals).toEqual({ incomeCents: 1000, expenseCents: 0, resultCents: 1000 });
  });

  it("lista vazia: tudo zero", () => {
    expect(computeTransactionTotals([])).toEqual({ incomeCents: 0, expenseCents: 0, resultCents: 0 });
  });
});

function tx(overrides: Partial<TransactionForTopExpenses> = {}): TransactionForTopExpenses {
  return { id: "tx-1", description: "Lançamento", occurredOn: "2026-09-10", categoryId: null, amountCents: -1000, kind: "normal", ...overrides };
}

describe("topExpenses", () => {
  it("ordena do maior gasto (mais negativo) pro menor e corta no limite", () => {
    const rows = [tx({ id: "a", amountCents: -5000 }), tx({ id: "b", amountCents: -20000 }), tx({ id: "c", amountCents: -1000 })];
    expect(topExpenses(rows, 2).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("ignora entradas (amountCents positivo)", () => {
    const rows = [tx({ id: "a", amountCents: -1000 }), tx({ id: "b", amountCents: 5000 })];
    expect(topExpenses(rows, 5).map((r) => r.id)).toEqual(["a"]);
  });

  it("ignora transferência e pagamento de fatura", () => {
    const rows = [tx({ id: "a", amountCents: -1000, kind: "transfer" }), tx({ id: "b", amountCents: -2000, kind: "card_payment" })];
    expect(topExpenses(rows, 5)).toEqual([]);
  });

  it("conta ajuste negativo como gasto", () => {
    const rows = [tx({ id: "a", amountCents: -3000, kind: "adjustment" })];
    expect(topExpenses(rows, 5).map((r) => r.id)).toEqual(["a"]);
  });

  it("lista vazia devolve vazio", () => {
    expect(topExpenses([], 5)).toEqual([]);
  });
});
