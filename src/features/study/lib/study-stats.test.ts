import { describe, expect, it } from "vitest";
import { computeAccuracyRate, computeForecast, computeReviewsPerDay } from "./study-stats";

describe("computeAccuracyRate", () => {
  it("null sem revisões", () => {
    expect(computeAccuracyRate([])).toBeNull();
  });

  it("conta 2/3/4 como acerto e 1 (Errei) como erro", () => {
    expect(computeAccuracyRate([{ rating: 1 }, { rating: 2 }, { rating: 3 }, { rating: 4 }])).toBe(75);
  });

  it("100% quando nunca errou", () => {
    expect(computeAccuracyRate([{ rating: 3 }, { rating: 4 }])).toBe(100);
  });
});

describe("computeReviewsPerDay", () => {
  it("monta os últimos N dias (incluindo hoje) com contagem por dia", () => {
    const logs = [
      { dateKey: "2026-09-20", rating: 3 },
      { dateKey: "2026-09-20", rating: 2 },
      { dateKey: "2026-09-22", rating: 3 },
    ];
    expect(computeReviewsPerDay(logs, "2026-09-22", 3)).toEqual([
      { date: "2026-09-20", count: 2 },
      { date: "2026-09-21", count: 0 },
      { date: "2026-09-22", count: 1 },
    ]);
  });
});

describe("computeForecast", () => {
  it("monta os próximos N dias (a partir de hoje) com contagem por dia", () => {
    const due = ["2026-09-22", "2026-09-22", "2026-09-24"];
    expect(computeForecast(due, "2026-09-22", 3)).toEqual([
      { date: "2026-09-22", count: 2 },
      { date: "2026-09-23", count: 0 },
      { date: "2026-09-24", count: 1 },
    ]);
  });
});
