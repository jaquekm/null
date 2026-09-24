import { describe, expect, it } from "vitest";
import { computeSubscriptionSavings } from "./subscription-savings";

describe("computeSubscriptionSavings", () => {
  it("separa economia realizada (canceladas) de potencial (ainda pagando)", () => {
    const result = computeSubscriptionSavings([
      { monthlyCostCents: 3000, canceledAt: "2026-06-01" },
      { monthlyCostCents: 2000, canceledAt: null },
      { monthlyCostCents: 1500, canceledAt: "2026-08-01" },
    ]);

    expect(result.realizedMonthlyCents).toBe(4500);
    expect(result.pendingMonthlyCents).toBe(2000);
    expect(result.totalTrackedMonthlyCents).toBe(6500);
  });

  it("lista vazia: tudo zero", () => {
    expect(computeSubscriptionSavings([])).toEqual({
      realizedMonthlyCents: 0,
      pendingMonthlyCents: 0,
      totalTrackedMonthlyCents: 0,
    });
  });
});
