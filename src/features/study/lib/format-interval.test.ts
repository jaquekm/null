import { describe, expect, it } from "vitest";
import { formatFsrsInterval } from "./format-interval";

describe("formatFsrsInterval", () => {
  it("formata minutos (<1h)", () => {
    expect(formatFsrsInterval("2026-09-22T12:30:00.000Z", "2026-09-22T12:00:00.000Z")).toBe("30 min");
  });

  it("formata horas (<24h)", () => {
    expect(formatFsrsInterval("2026-09-22T13:30:00.000Z", "2026-09-22T12:00:00.000Z")).toBe("2 h");
  });

  it("formata dias, com singular", () => {
    expect(formatFsrsInterval("2026-09-23T12:00:00.000Z", "2026-09-22T12:00:00.000Z")).toBe("1 dia");
    expect(formatFsrsInterval("2026-09-30T12:00:00.000Z", "2026-09-22T12:00:00.000Z")).toBe("8 dias");
  });

  it("formata meses (>=30 dias, <12 meses)", () => {
    expect(formatFsrsInterval("2026-11-17T12:00:00.000Z", "2026-09-22T12:00:00.000Z")).toBe("2 meses");
  });

  it("formata anos, com singular", () => {
    expect(formatFsrsInterval("2027-09-22T12:00:00.000Z", "2026-09-22T12:00:00.000Z")).toBe("1 ano");
  });

  it("nunca fica negativo se `due` for anterior a `now`", () => {
    expect(formatFsrsInterval("2026-09-22T11:00:00.000Z", "2026-09-22T12:00:00.000Z")).toBe("1 min");
  });
});
