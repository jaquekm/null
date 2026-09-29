import { describe, expect, it } from "vitest";
import { billsDueSoon, daySummary, dueLabel, formatDayHeader, formatTime, greeting } from "./today";

describe("greeting", () => {
  it("manhã, tarde e noite (madrugada é noite)", () => {
    expect([greeting(4), greeting(5), greeting(11), greeting(12), greeting(17), greeting(18), greeting(23)]).toEqual([
      "Boa noite",
      "Bom dia",
      "Bom dia",
      "Boa tarde",
      "Boa tarde",
      "Boa noite",
      "Boa noite",
    ]);
  });
});

describe("formatDayHeader / formatTime", () => {
  it("dia por extenso sem escorregar de fuso", () => {
    expect(formatDayHeader("2026-09-29")).toBe("terça-feira, 29 de setembro");
    expect(formatDayHeader("2026-01-01")).toBe("quinta-feira, 1 de janeiro");
  });

  it("hora no fuso de São Paulo", () => {
    expect(formatTime("2026-09-29T12:30:00Z", "America/Sao_Paulo")).toBe("09:30");
  });
});

describe("dueLabel", () => {
  it("fala o prazo em palavras", () => {
    expect(dueLabel("2026-09-29", "2026-09-29")).toBe("vence hoje");
    expect(dueLabel("2026-09-30", "2026-09-29")).toBe("vence amanhã");
    expect(dueLabel("2026-10-04", "2026-09-29")).toBe("vence em 5 dias");
    expect(dueLabel("2026-09-28", "2026-09-29")).toBe("venceu ontem");
    expect(dueLabel("2026-09-26", "2026-09-29")).toBe("venceu há 3 dias");
  });
});

describe("billsDueSoon", () => {
  const base = { direction: "payable", status: "open", paidCents: 0, amountCents: 10000 };
  it("só contas a pagar em aberto, vencidas ou nos próximos 7 dias, da mais urgente pra menos", () => {
    const bills = [
      { ...base, id: "a", description: "Luz", dueOn: "2026-10-03" },
      { ...base, id: "b", description: "Aluguel", dueOn: "2026-09-25", paidCents: 4000, status: "partial" },
      { ...base, id: "c", description: "Longe", dueOn: "2026-10-20" },
      { ...base, id: "d", description: "Paga", dueOn: "2026-09-30", status: "paid" },
      { ...base, id: "e", description: "A receber", dueOn: "2026-09-30", direction: "receivable" },
    ];
    expect(billsDueSoon(bills, "2026-09-29").map((b) => [b.id, b.dueLabel, b.remainingCents, b.overdue])).toEqual([
      ["b", "venceu há 4 dias", 6000, true],
      ["a", "vence em 4 dias", 10000, false],
    ]);
  });
});

describe("daySummary", () => {
  it("junta o que tem e fala quando o dia está livre", () => {
    expect(daySummary({ events: 2, reminders: 1, tasks: 0, bills: 1 })).toBe("Hoje: 2 compromissos, 1 lembrete e 1 conta vencendo.");
    expect(daySummary({ events: 0, reminders: 0, tasks: 3, bills: 0 })).toBe("Hoje: 3 prazos.");
    expect(daySummary({ events: 0, reminders: 0, tasks: 0, bills: 0 })).toBe("Dia livre por aqui — nada marcado pra hoje.");
  });
});
