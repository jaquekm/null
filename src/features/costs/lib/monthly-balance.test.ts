import { describe, expect, it } from "vitest";
import { computeMonthlyBalanceSeries } from "./monthly-balance";

describe("computeMonthlyBalanceSeries", () => {
  const subscriptions = [
    { monthlyCostCents: 3000, canceledAt: "2026-07-15" },
    { monthlyCostCents: 2000, canceledAt: null },
  ];
  const costs = [
    { referenceMonth: "2026-06-01", amountCents: 5000 },
    { referenceMonth: "2026-07-01", amountCents: 6000 },
    { referenceMonth: "2026-08-01", amountCents: 6000 },
  ];

  it("economia só entra a partir do mês do cancelamento e persiste depois", () => {
    const series = computeMonthlyBalanceSeries(subscriptions, costs, ["2026-06", "2026-07", "2026-08"]);

    expect(series).toEqual([
      { month: "2026-06", savingsCents: 0, costsCents: 5000, balanceCents: -5000 },
      { month: "2026-07", savingsCents: 3000, costsCents: 6000, balanceCents: -3000 },
      { month: "2026-08", savingsCents: 3000, costsCents: 6000, balanceCents: -3000 },
    ]);
  });

  it("assinatura ainda não cancelada nunca entra no saldo", () => {
    const series = computeMonthlyBalanceSeries([{ monthlyCostCents: 9999, canceledAt: null }], [], ["2026-01"]);
    expect(series[0]!.savingsCents).toBe(0);
  });

  it("mês sem custo lançado: costsCents zero", () => {
    const series = computeMonthlyBalanceSeries([], [], ["2026-09"]);
    expect(series).toEqual([{ month: "2026-09", savingsCents: 0, costsCents: 0, balanceCents: 0 }]);
  });
});
