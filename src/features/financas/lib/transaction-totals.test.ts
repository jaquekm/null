import { describe, expect, it } from "vitest";
import { computeTransactionTotals } from "./transaction-totals";

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
