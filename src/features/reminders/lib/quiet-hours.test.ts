import { describe, expect, it } from "vitest";
import { applyQuietHours, isWithinQuietHours } from "./quiet-hours";

describe("isWithinQuietHours", () => {
  it("21h, 23h e 0h estão no silêncio (janela cruza a meia-noite)", () => {
    expect(isWithinQuietHours(21)).toBe(true);
    expect(isWithinQuietHours(23)).toBe(true);
    expect(isWithinQuietHours(0)).toBe(true);
    expect(isWithinQuietHours(7)).toBe(true);
  });

  it("8h e 20h não estão no silêncio", () => {
    expect(isWithinQuietHours(8)).toBe(false);
    expect(isWithinQuietHours(20)).toBe(false);
    expect(isWithinQuietHours(14)).toBe(false);
  });
});

describe("applyQuietHours", () => {
  const timezone = "America/Sao_Paulo";

  it("fora do horário silencioso: devolve o instante sem alteração", () => {
    const instant = new Date("2026-01-15T15:00:00.000Z"); // 12:00 local
    expect(applyQuietHours(instant, timezone)).toEqual(instant);
  });

  it("de madrugada (antes das 8h): move pras 8h do mesmo dia", () => {
    const instant = new Date("2026-01-15T08:00:00.000Z"); // 05:00 local
    const result = applyQuietHours(instant, timezone);
    expect(result.toISOString()).toBe("2026-01-15T11:00:00.000Z"); // 08:00 local
  });

  it("à noite (21h ou depois): move pras 8h do dia seguinte", () => {
    const instant = new Date("2026-01-16T01:00:00.000Z"); // 22:00 local (15/01)
    const result = applyQuietHours(instant, timezone);
    expect(result.toISOString()).toBe("2026-01-16T11:00:00.000Z"); // 08:00 local (16/01)
  });

  it("exatamente às 21h: já é silêncio, move pro dia seguinte", () => {
    const instant = new Date("2026-01-16T00:00:00.000Z"); // 21:00 local (15/01)
    const result = applyQuietHours(instant, timezone);
    expect(result.toISOString()).toBe("2026-01-16T11:00:00.000Z"); // 08:00 local (16/01)
  });

  it("exatamente às 8h: não é mais silêncio", () => {
    const instant = new Date("2026-01-15T11:00:00.000Z"); // 08:00 local
    expect(applyQuietHours(instant, timezone)).toEqual(instant);
  });
});
