import { describe, expect, it } from "vitest";
import { averageDurationMinutes, elapsedMinutes, formatFastingDuration } from "./fasting";

describe("elapsedMinutes", () => {
  it("conta os minutos inteiros desde o início", () => {
    const startedAt = "2026-10-01T08:00:00.000Z";
    const now = new Date("2026-10-01T22:30:00.000Z");
    expect(elapsedMinutes(startedAt, now)).toBe(14 * 60 + 30);
  });

  it("nunca devolve negativo (relógio do cliente um tico atrasado)", () => {
    const startedAt = "2026-10-01T08:00:30.000Z";
    const now = new Date("2026-10-01T08:00:00.000Z");
    expect(elapsedMinutes(startedAt, now)).toBe(0);
  });
});

describe("formatFastingDuration", () => {
  it("só minutos quando dá menos de 1h", () => {
    expect(formatFastingDuration(45)).toBe("45min");
    expect(formatFastingDuration(0)).toBe("0min");
  });

  it("só horas quando fecha redondo", () => {
    expect(formatFastingDuration(16 * 60)).toBe("16h");
  });

  it("horas e minutos", () => {
    expect(formatFastingDuration(16 * 60 + 32)).toBe("16h 32min");
  });
});

describe("averageDurationMinutes", () => {
  it("null sem nenhum jejum ainda", () => {
    expect(averageDurationMinutes([])).toBeNull();
  });

  it("média arredondada", () => {
    expect(averageDurationMinutes([600, 700, 650])).toBe(650);
    expect(averageDurationMinutes([600, 601])).toBe(601);
  });
});
