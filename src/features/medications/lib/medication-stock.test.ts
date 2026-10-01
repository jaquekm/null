import { describe, expect, it } from "vitest";
import { daysUntilEmpty, dosesPerDay, formatHorarios, isLowStock } from "./medication-stock";

describe("dosesPerDay", () => {
  it("um horário por dose", () => expect(dosesPerDay(["08:00", "20:00"])).toBe(2));
  it("sem horário fixo, assume 1 dose/dia", () => expect(dosesPerDay([])).toBe(1));
});

describe("daysUntilEmpty", () => {
  it("divide e arredonda pra baixo", () => expect(daysUntilEmpty(14, 3)).toBe(4));
  it("divide exato", () => expect(daysUntilEmpty(15, 3)).toBe(5));
  it("estoque zerado", () => expect(daysUntilEmpty(0, 2)).toBe(0));
  it("sem doses por dia não divide por zero", () => expect(daysUntilEmpty(10, 0)).toBe(Infinity));
});

describe("isLowStock", () => {
  it("5 dias ou menos avisa", () => {
    expect(isLowStock(5)).toBe(true);
    expect(isLowStock(0)).toBe(true);
  });
  it("mais de 5 dias não avisa", () => expect(isLowStock(6)).toBe(false));
});

describe("formatHorarios", () => {
  it("ordena e junta", () => expect(formatHorarios(["20:00", "08:00"])).toBe("08:00, 20:00"));
  it("sem horário fixo", () => expect(formatHorarios([])).toBe("sem horário fixo"));
});
