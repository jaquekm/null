import { describe, expect, it } from "vitest";
import { computeCashProjection } from "./cash-projection";

describe("computeCashProjection", () => {
  it("sem eventos: saldo repete o mesmo valor em todos os dias", () => {
    const projection = computeCashProjection(10000, [], ["2026-09-22", "2026-09-23", "2026-09-24"]);
    expect(projection).toEqual([
      { date: "2026-09-22", balanceCents: 10000 },
      { date: "2026-09-23", balanceCents: 10000 },
      { date: "2026-09-24", balanceCents: 10000 },
    ]);
  });

  it("aplica o evento no dia certo e mantém acumulado nos dias seguintes", () => {
    const projection = computeCashProjection(10000, [{ date: "2026-09-23", amountCents: -5000 }], ["2026-09-22", "2026-09-23", "2026-09-24"]);
    expect(projection).toEqual([
      { date: "2026-09-22", balanceCents: 10000 },
      { date: "2026-09-23", balanceCents: 5000 },
      { date: "2026-09-24", balanceCents: 5000 },
    ]);
  });

  it("soma vários eventos no mesmo dia", () => {
    const projection = computeCashProjection(
      0,
      [
        { date: "2026-09-22", amountCents: 10000 },
        { date: "2026-09-22", amountCents: -3000 },
      ],
      ["2026-09-22"],
    );
    expect(projection).toEqual([{ date: "2026-09-22", balanceCents: 7000 }]);
  });

  it("evento numa data fora da lista de dias não afeta a projeção", () => {
    const projection = computeCashProjection(1000, [{ date: "2026-10-05", amountCents: -1000 }], ["2026-09-22", "2026-09-23"]);
    expect(projection.every((d) => d.balanceCents === 1000)).toBe(true);
  });

  it("saldo pode ficar negativo (projeta um aperto futuro)", () => {
    const projection = computeCashProjection(1000, [{ date: "2026-09-22", amountCents: -5000 }], ["2026-09-22"]);
    expect(projection[0]).toEqual({ date: "2026-09-22", balanceCents: -4000 });
  });

  it("lista de dias vazia devolve vazio", () => {
    expect(computeCashProjection(1000, [{ date: "2026-09-22", amountCents: -100 }], [])).toEqual([]);
  });
});
