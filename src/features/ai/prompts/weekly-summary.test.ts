import { describe, expect, it } from "vitest";
import { buildWeeklySummaryMessage } from "./weekly-summary";
import type { WeeklyReviewReportData } from "@/features/reports/generators/weekly-review-report";

function data(overrides: Partial<WeeklyReviewReportData> = {}): WeeklyReviewReportData {
  return {
    itemsCreatedCount: 0,
    tasksCompleted: [],
    meetings: [],
    financeEnabled: false,
    incomeCents: 0,
    expenseCents: 0,
    resultCents: 0,
    studyMinutes: 0,
    ...overrides,
  };
}

describe("buildWeeklySummaryMessage", () => {
  it("lista contagens e títulos de tarefas/reuniões", () => {
    const message = buildWeeklySummaryMessage(
      data({ itemsCreatedCount: 5, tasksCompleted: [{ id: "1", title: "Enviar proposta" }], meetings: [{ id: "2", title: "Reunião com Acme", date: "2026-08-10" }] }),
      "2026-08-04",
      "2026-08-10",
    );

    expect(message).toContain("Período: 2026-08-04 a 2026-08-10");
    expect(message).toContain("Itens criados: 5");
    expect(message).toContain("Tarefas concluídas (1): Enviar proposta");
    expect(message).toContain("Reuniões (1): Reunião com Acme");
  });

  it("sem tarefas/reuniões: diz 'nenhuma' em vez de string vazia", () => {
    const message = buildWeeklySummaryMessage(data(), "2026-08-04", "2026-08-10");

    expect(message).toContain("Tarefas concluídas (0): nenhuma");
    expect(message).toContain("Reuniões (0): nenhuma");
  });

  it("com finanças habilitadas: inclui entradas/saídas/resultado formatados", () => {
    const message = buildWeeklySummaryMessage(data({ financeEnabled: true, incomeCents: 500000, expenseCents: -320000, resultCents: 180000 }), "2026-08-04", "2026-08-10");

    expect(message).toContain("Entradas: R$ 5.000,00");
    expect(message).toContain("Saídas: -R$ 3.200,00");
    expect(message).toContain("Resultado: R$ 1.800,00");
  });

  it("sem finanças habilitadas: não menciona entradas/saídas", () => {
    const message = buildWeeklySummaryMessage(data({ financeEnabled: false }), "2026-08-04", "2026-08-10");

    expect(message).not.toContain("Entradas:");
    expect(message).not.toContain("Saídas:");
  });
});
