import { describe, expect, it } from "vitest";
import { formatFocusDuration, summarizeFocusSessions } from "./focus-summary";

describe("summarizeFocusSessions", () => {
  it("soma os minutos de sessões do mesmo item", () => {
    const summary = summarizeFocusSessions([
      { itemId: "a", itemTitle: "Tarefa A", durationMinutes: 25 },
      { itemId: "a", itemTitle: "Tarefa A", durationMinutes: 30 },
    ]);

    expect(summary.totalMinutes).toBe(55);
    expect(summary.byItem).toEqual([{ itemId: "a", itemTitle: "Tarefa A", minutes: 55 }]);
  });

  it("ordena do item com mais tempo pro com menos", () => {
    const summary = summarizeFocusSessions([
      { itemId: "a", itemTitle: "A", durationMinutes: 10 },
      { itemId: "b", itemTitle: "B", durationMinutes: 40 },
      { itemId: "c", itemTitle: "C", durationMinutes: 25 },
    ]);

    expect(summary.byItem.map((entry) => entry.itemId)).toEqual(["b", "c", "a"]);
  });

  it("item sem título vira 'Sem título'", () => {
    const summary = summarizeFocusSessions([{ itemId: "a", itemTitle: null, durationMinutes: 10 }]);
    expect(summary.byItem[0]).toMatchObject({ itemTitle: "Sem título" });
  });

  it("sessão sem item (itemId null) agrupa em 'Sem tarefa'", () => {
    const summary = summarizeFocusSessions([
      { itemId: null, itemTitle: null, durationMinutes: 10 },
      { itemId: null, itemTitle: null, durationMinutes: 5 },
    ]);
    expect(summary.byItem).toEqual([{ itemId: null, itemTitle: "Sem tarefa", minutes: 15 }]);
  });

  it("durationMinutes null conta como 0 (sessão em andamento, sem duração salva ainda)", () => {
    const summary = summarizeFocusSessions([{ itemId: "a", itemTitle: "A", durationMinutes: null }]);
    expect(summary.totalMinutes).toBe(0);
  });

  it("lista vazia devolve resumo zerado", () => {
    expect(summarizeFocusSessions([])).toEqual({ totalMinutes: 0, byItem: [] });
  });
});

describe("formatFocusDuration", () => {
  it("só minutos", () => expect(formatFocusDuration(45)).toBe("45min"));
  it("horas exatas", () => expect(formatFocusDuration(120)).toBe("2h"));
  it("horas e minutos", () => expect(formatFocusDuration(135)).toBe("2h 15min"));
  it("zero", () => expect(formatFocusDuration(0)).toBe("0min"));
  it("arredonda e nunca fica negativo", () => {
    expect(formatFocusDuration(1.6)).toBe("2min");
    expect(formatFocusDuration(-5)).toBe("0min");
  });
});
