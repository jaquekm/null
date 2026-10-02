import { describe, expect, it } from "vitest";
import type { WeeklyCheckinData } from "@/features/weekly-checkin/queries";
import { buildWeeklyCheckinMessage } from "./weekly-checkin";

function data(overrides: Partial<WeeklyCheckinData> = {}): WeeklyCheckinData {
  return { habits: null, budget: null, workoutsCount: 0, weight: null, medications: [], ...overrides };
}

describe("buildWeeklyCheckinMessage", () => {
  it("inclui hábitos quando existe o tipo", () => {
    const message = buildWeeklyCheckinMessage(data({ habits: { done: 18, scheduled: 21 } }), true);
    expect(message).toContain("Hábitos: 18 de 21 marcações feitas essa semana.");
  });

  it("sem hábitos (tipo não existe), não menciona", () => {
    const message = buildWeeklyCheckinMessage(data(), true);
    expect(message).not.toContain("Hábitos:");
  });

  it("peso com e sem semana anterior pra comparar", () => {
    expect(buildWeeklyCheckinMessage(data({ weight: { currentKg: 70, previousKg: 71 } }), true)).toContain("Peso: 70 kg (semana anterior: 71 kg).");
    expect(buildWeeklyCheckinMessage(data({ weight: { currentKg: 70, previousKg: null } }), true)).toContain("Peso: 70 kg.");
  });

  it("remédios: lista cada um com doses tomadas e esquecidas", () => {
    const message = buildWeeklyCheckinMessage(
      data({ medications: [{ medicationId: "a", name: "Vitamina D", expectedDoses: 7, takenDoses: 5, missedDoses: 2 }] }),
      true,
    );
    expect(message).toContain("Vitamina D — 5 de 7 doses, 2 esquecida(s)");
  });

  it("orçamento só entra quando includeBudget é true, mesmo com o dado disponível", () => {
    const withBudget = data({ budget: { spentCents: 100_000, budgetCents: 150_000, overCategories: [] } });
    expect(buildWeeklyCheckinMessage(withBudget, true)).toContain("Orçamento do mês:");
    expect(buildWeeklyCheckinMessage(withBudget, false)).not.toContain("Orçamento");
  });

  it("categorias que passaram do limite aparecem no texto", () => {
    const message = buildWeeklyCheckinMessage(data({ budget: { spentCents: 200_000, budgetCents: 150_000, overCategories: ["Lazer"] } }), true);
    expect(message).toContain("passou do limite em: Lazer");
  });
});
