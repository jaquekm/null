import { describe, expect, it } from "vitest";
import { missedDosesForWeek } from "./dose-log";

describe("missedDosesForWeek", () => {
  it("sem nenhuma dose tomada, falta tudo", () => {
    const usage = missedDosesForWeek([{ id: "a", name: "Vitamina D", horarios: ["08:00"] }], new Map(), 7);
    expect(usage).toEqual([{ medicationId: "a", name: "Vitamina D", expectedDoses: 7, takenDoses: 0, missedDoses: 7 }]);
  });

  it("todas as doses tomadas, nada falta", () => {
    const usage = missedDosesForWeek([{ id: "a", name: "Vitamina D", horarios: ["08:00", "20:00"] }], new Map([["a", 14]]), 7);
    expect(usage[0]).toMatchObject({ expectedDoses: 14, takenDoses: 14, missedDoses: 0 });
  });

  it("tomar mais do que o esperado não vira falta negativa", () => {
    const usage = missedDosesForWeek([{ id: "a", name: "Vitamina D", horarios: ["08:00"] }], new Map([["a", 10]]), 7);
    expect(usage[0]!.missedDoses).toBe(0);
  });

  it("remédio sem horário fixo não entra (não dá pra calcular esperado)", () => {
    const usage = missedDosesForWeek([{ id: "a", name: "Sem horário", horarios: [] }], new Map(), 7);
    expect(usage).toEqual([]);
  });
});
