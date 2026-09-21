import { describe, expect, it } from "vitest";
import { monthPeriod, shiftMonth } from "./period-range";

describe("monthPeriod", () => {
  it("mês de 30 dias", () => {
    expect(monthPeriod("2026-09")).toEqual({
      month: "2026-09",
      start: "2026-09-01",
      end: "2026-09-30",
      label: "Setembro de 2026",
    });
  });

  it("fevereiro em ano comum", () => {
    expect(monthPeriod("2026-02")).toMatchObject({ start: "2026-02-01", end: "2026-02-28" });
  });

  it("fevereiro em ano bissexto", () => {
    expect(monthPeriod("2028-02")).toMatchObject({ start: "2028-02-01", end: "2028-02-29" });
  });

  it("mês de 31 dias", () => {
    expect(monthPeriod("2026-01")).toMatchObject({ start: "2026-01-01", end: "2026-01-31" });
  });
});

describe("shiftMonth", () => {
  it("mês seguinte", () => {
    expect(shiftMonth("2026-09", 1)).toBe("2026-10");
  });

  it("mês anterior", () => {
    expect(shiftMonth("2026-09", -1)).toBe("2026-08");
  });

  it("vira o ano pra frente", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("vira o ano pra trás", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});
