import { describe, expect, it } from "vitest";
import { buildCashflowSeries } from "./cashflow-series";

describe("buildCashflowSeries", () => {
  it("agrupa por mês (prefixo de occurredOn) e soma entradas/saídas de cada um", () => {
    const series = buildCashflowSeries(
      [
        { occurredOn: "2026-08-05", amountCents: 100000, kind: "normal" },
        { occurredOn: "2026-08-20", amountCents: -30000, kind: "normal" },
        { occurredOn: "2026-09-01", amountCents: -5000, kind: "normal" },
      ],
      ["2026-08", "2026-09"],
    );
    expect(series).toEqual([
      { month: "2026-08", incomeCents: 100000, expenseCents: -30000, resultCents: 70000 },
      { month: "2026-09", incomeCents: 0, expenseCents: -5000, resultCents: -5000 },
    ]);
  });

  it("mês sem nenhum lançamento entra zerado (não desaparece da série)", () => {
    const series = buildCashflowSeries([{ occurredOn: "2026-08-05", amountCents: 1000, kind: "normal" }], ["2026-07", "2026-08"]);
    expect(series[0]).toEqual({ month: "2026-07", incomeCents: 0, expenseCents: 0, resultCents: 0 });
  });

  it("ignora transferência/pagamento de fatura, igual computeTransactionTotals", () => {
    const series = buildCashflowSeries(
      [
        { occurredOn: "2026-08-05", amountCents: -50000, kind: "transfer" },
        { occurredOn: "2026-08-05", amountCents: -80000, kind: "card_payment" },
      ],
      ["2026-08"],
    );
    expect(series[0]).toEqual({ month: "2026-08", incomeCents: 0, expenseCents: 0, resultCents: 0 });
  });

  it("lista de meses vazia devolve série vazia", () => {
    expect(buildCashflowSeries([{ occurredOn: "2026-08-05", amountCents: 1000, kind: "normal" }], [])).toEqual([]);
  });

  it("preserva a ordem dos meses passados, não reordena", () => {
    const series = buildCashflowSeries([], ["2026-09", "2026-07", "2026-08"]);
    expect(series.map((s) => s.month)).toEqual(["2026-09", "2026-07", "2026-08"]);
  });
});
