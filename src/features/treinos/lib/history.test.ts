import { describe, expect, it } from "vitest";
import { formatSessionDay, groupByWeek, summarizeSession, weekLabel, weekStartOf } from "./history";

describe("semanas", () => {
  it("semana começa na segunda", () => {
    expect(weekStartOf("2026-09-29")).toBe("2026-09-28"); // terça → segunda
    expect(weekStartOf("2026-09-28")).toBe("2026-09-28");
    expect(weekStartOf("2026-10-04")).toBe("2026-09-28"); // domingo fica na mesma semana
  });

  it("rótulos relativos a hoje", () => {
    expect(weekLabel("2026-09-28", "2026-09-29")).toBe("Esta semana");
    expect(weekLabel("2026-09-21", "2026-09-29")).toBe("Semana passada");
    expect(weekLabel("2026-09-14", "2026-09-29")).toBe("Semana de 14/09");
  });

  it("dia da semana por extenso curto, sem deslocar pelo fuso", () => {
    expect(formatSessionDay("2026-09-29")).toBe("Ter, 29/09");
    expect(formatSessionDay("2026-10-04")).toBe("Dom, 04/10");
  });

  it("agrupa da semana mais recente pra mais antiga", () => {
    const groups = groupByWeek([
      { id: "a", date: "2026-09-22" },
      { id: "b", date: "2026-09-29" },
      { id: "c", date: "2026-09-28" },
    ]);
    expect(groups.map((g) => [g.weekStart, g.sessions.map((s) => s.id)])).toEqual([
      ["2026-09-28", ["b", "c"]],
      ["2026-09-21", ["a"]],
    ]);
  });
});

describe("summarizeSession", () => {
  it("conta exercícios feitos, séries e volume (ignora pulados)", () => {
    const summary = summarizeSession({
      legpress: { load: "40", reps: ["12", "12", "10"], rir: 2, pain: 0, note: "", skipped: false },
      deadbug: { load: "", reps: ["8", "8"], rir: null, pain: 0, note: "", skipped: false },
      puxada: { load: "30", reps: ["12"], rir: null, pain: 0, note: "", skipped: true },
    });
    expect(summary).toEqual({ exercisesDone: 2, sets: 5, volumeKg: 1360 });
  });
});
