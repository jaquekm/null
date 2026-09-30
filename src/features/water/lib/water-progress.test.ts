import { describe, expect, it } from "vitest";
import { fillWaterHistory, waterProgressPercent, weekdayLetter } from "./water-progress";

describe("waterProgressPercent", () => {
  it("proporção normal", () => expect(waterProgressPercent(1000, 2000)).toBe(50));
  it("meta batida exatamente", () => expect(waterProgressPercent(2000, 2000)).toBe(100));
  it("passou da meta, não passa de 100", () => expect(waterProgressPercent(3000, 2000)).toBe(100));
  it("nada bebido ainda", () => expect(waterProgressPercent(0, 2000)).toBe(0));
  it("meta zero ou negativa não divide por zero", () => {
    expect(waterProgressPercent(500, 0)).toBe(0);
    expect(waterProgressPercent(500, -100)).toBe(0);
  });
});

describe("fillWaterHistory", () => {
  it("preenche 7 dias terminando em hoje, com 0 onde não tem registro", () => {
    const history = fillWaterHistory([{ day: "2026-09-30", totalMl: 1500 }], 7, "2026-09-30");
    expect(history).toHaveLength(7);
    expect(history[0]!.day).toBe("2026-09-24");
    expect(history.at(-1)).toEqual({ day: "2026-09-30", totalMl: 1500 });
    expect(history[0]!.totalMl).toBe(0);
  });

  it("sem nenhum registro, todos os dias vêm com 0", () => {
    const history = fillWaterHistory([], 3, "2026-09-30");
    expect(history.map((d) => d.totalMl)).toEqual([0, 0, 0]);
    expect(history.map((d) => d.day)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30"]);
  });

  it("registro fora da janela pedida é ignorado", () => {
    const history = fillWaterHistory([{ day: "2026-09-01", totalMl: 9999 }], 3, "2026-09-30");
    expect(history.every((d) => d.totalMl === 0)).toBe(true);
  });
});

describe("weekdayLetter", () => {
  it("30/09/2026 é quarta", () => expect(weekdayLetter("2026-09-30")).toBe("Q"));
  it("04/10/2026 é domingo", () => expect(weekdayLetter("2026-10-04")).toBe("D"));
  it("03/10/2026 é sábado", () => expect(weekdayLetter("2026-10-03")).toBe("S"));
});
