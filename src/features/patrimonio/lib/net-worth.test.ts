import { describe, expect, it } from "vitest";
import { fillMonthlySnapshots, latestValueCents, netWorthSeries } from "./net-worth";

const MONTHS = ["2026-07", "2026-08", "2026-09"];

describe("fillMonthlySnapshots", () => {
  it("repete o último valor conhecido nos meses sem registro", () => {
    const filled = fillMonthlySnapshots([{ month: "2026-07", valueCents: 10_000 }], MONTHS);
    expect(filled).toEqual([
      { month: "2026-07", valueCents: 10_000 },
      { month: "2026-08", valueCents: 10_000 },
      { month: "2026-09", valueCents: 10_000 },
    ]);
  });

  it("0 antes do primeiro registro", () => {
    const filled = fillMonthlySnapshots([{ month: "2026-09", valueCents: 5_000 }], MONTHS);
    expect(filled.map((f) => f.valueCents)).toEqual([0, 0, 5_000]);
  });

  it("sem nenhum registro, tudo 0", () => {
    expect(fillMonthlySnapshots([], MONTHS).map((f) => f.valueCents)).toEqual([0, 0, 0]);
  });

  it("usa o valor de cada mês quando registrado", () => {
    const filled = fillMonthlySnapshots(
      [
        { month: "2026-07", valueCents: 1_000 },
        { month: "2026-09", valueCents: 3_000 },
      ],
      MONTHS,
    );
    expect(filled.map((f) => f.valueCents)).toEqual([1_000, 1_000, 3_000]);
  });
});

describe("netWorthSeries", () => {
  it("soma investimentos como ativo e dívidas como passivo", () => {
    const series = netWorthSeries(
      [
        { kind: "investimento", snapshots: [{ month: "2026-09", valueCents: 10_000 }] },
        { kind: "divida", snapshots: [{ month: "2026-09", valueCents: 4_000 }] },
      ],
      ["2026-09"],
    );
    expect(series).toEqual([{ month: "2026-09", assetsCents: 10_000, debtsCents: 4_000, netCents: 6_000 }]);
  });

  it("sem itens, série toda zerada", () => {
    expect(netWorthSeries([], MONTHS)).toEqual(MONTHS.map((month) => ({ month, assetsCents: 0, debtsCents: 0, netCents: 0 })));
  });

  it("preenche lacunas de cada item antes de somar", () => {
    const series = netWorthSeries([{ kind: "investimento", snapshots: [{ month: "2026-07", valueCents: 1_000 }] }], MONTHS);
    expect(series.map((s) => s.assetsCents)).toEqual([1_000, 1_000, 1_000]);
  });
});

describe("latestValueCents", () => {
  it("null sem nenhum registro", () => {
    expect(latestValueCents([])).toBeNull();
  });

  it("o valor do mês mais recente, independente da ordem de entrada", () => {
    expect(
      latestValueCents([
        { month: "2026-07", valueCents: 1_000 },
        { month: "2026-09", valueCents: 3_000 },
        { month: "2026-08", valueCents: 2_000 },
      ]),
    ).toBe(3_000);
  });
});
