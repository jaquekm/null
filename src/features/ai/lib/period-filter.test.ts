import { describe, expect, it } from "vitest";
import { isWithinPeriodUtc, periodBoundsUtc } from "./period-filter";

describe("periodBoundsUtc", () => {
  it("converte 'de' e 'até' pro início/fim do dia no fuso do dono, em UTC", () => {
    const bounds = periodBoundsUtc("2026-08-01", "2026-08-31", "America/Sao_Paulo");

    expect(bounds.startUtc).toBe("2026-08-01T03:00:00.000Z"); // 00:00 em -03:00
    expect(bounds.endUtc).toBe("2026-09-01T02:59:59.999Z"); // 23:59:59.999 em -03:00
  });

  it("sem dateFrom/dateTo: limites nulos (sem filtro)", () => {
    expect(periodBoundsUtc(undefined, undefined, "America/Sao_Paulo")).toEqual({ startUtc: null, endUtc: null });
  });
});

describe("isWithinPeriodUtc", () => {
  it("timestamp dentro do período: true", () => {
    const bounds = periodBoundsUtc("2026-08-01", "2026-08-31", "America/Sao_Paulo");
    expect(isWithinPeriodUtc("2026-08-15T12:00:00.000Z", bounds)).toBe(true);
  });

  it("timestamp antes do início: false — mesmo perto da virada do dia (regressão da comparação ingênua de string)", () => {
    const bounds = periodBoundsUtc("2026-08-01", "2026-08-31", "America/Sao_Paulo");
    // 2026-08-01T01:00:00Z é 31/07 22:00 em -03:00 — antes do período, mas uma
    // comparação de string ingênua entre "2026-08-01T01:00:00Z" e "2026-08-01" acharia que está dentro.
    expect(isWithinPeriodUtc("2026-08-01T01:00:00.000Z", bounds)).toBe(false);
  });

  it("timestamp depois do fim: false", () => {
    const bounds = periodBoundsUtc("2026-08-01", "2026-08-31", "America/Sao_Paulo");
    expect(isWithinPeriodUtc("2026-09-01T03:00:00.000Z", bounds)).toBe(false);
  });

  it("sem limites: sempre dentro", () => {
    expect(isWithinPeriodUtc("2026-01-01T00:00:00.000Z", { startUtc: null, endUtc: null })).toBe(true);
  });
});
