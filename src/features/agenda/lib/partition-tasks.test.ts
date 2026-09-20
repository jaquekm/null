import { describe, expect, it } from "vitest";
import type { AgendaEntry } from "./agenda-entry";
import { partitionTasksByDueness } from "./partition-tasks";

function task(id: string, start: string): AgendaEntry {
  return { id, title: id, start, end: null, allDay: true, color: "#000", editable: false, kind: "item-date", href: `/itens/${id}` };
}

const TODAY_START = "2026-01-15T03:00:00.000Z";

describe("partitionTasksByDueness", () => {
  it("separa atrasados (antes de hoje) de vencendo hoje", () => {
    const yesterday = task("y", "2026-01-14T03:00:00.000Z");
    const today = task("t", "2026-01-15T12:00:00.000Z");
    const result = partitionTasksByDueness([today, yesterday], TODAY_START);
    expect(result.overdue.map((t) => t.id)).toEqual(["y"]);
    expect(result.dueToday.map((t) => t.id)).toEqual(["t"]);
  });

  it("exatamente no início do dia conta como 'hoje', não atrasado", () => {
    const exact = task("exact", TODAY_START);
    const result = partitionTasksByDueness([exact], TODAY_START);
    expect(result.overdue).toEqual([]);
    expect(result.dueToday.map((t) => t.id)).toEqual(["exact"]);
  });

  it("cada grupo fica em ordem crescente por data", () => {
    const a = task("a", "2026-01-10T00:00:00.000Z");
    const b = task("b", "2026-01-05T00:00:00.000Z");
    const result = partitionTasksByDueness([a, b], TODAY_START);
    expect(result.overdue.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("lista vazia: os dois grupos vazios", () => {
    expect(partitionTasksByDueness([], TODAY_START)).toEqual({ overdue: [], dueToday: [] });
  });
});
