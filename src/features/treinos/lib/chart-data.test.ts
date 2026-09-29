import { describe, expect, it } from "vitest";
import { exerciseProgress, formatMinutes, trainingStats, weeklyCounts } from "./chart-data";
import type { ExerciseEntry, HistoryPoint } from "./rules";

const done: Record<string, ExerciseEntry> = { legpress: { load: "40", reps: ["12"], rir: 2, pain: 0, note: "", skipped: false } };
const cardio: Record<string, ExerciseEntry> = { legpress: { load: "", reps: [], rir: null, pain: 0, note: "", skipped: true } };
const s = (id: string, date: string, exercises = done, durationMin: number | null = 45) => ({
  id, date, week: 1, workout: "A", exercises, kneePainMorning: null, backPainMorning: null, durationMin,
});

describe("weeklyCounts", () => {
  it("8 semanas terminando na atual, com zeros nas semanas sem treino", () => {
    const counts = weeklyCounts([{ date: "2026-09-29" }, { date: "2026-09-30" }, { date: "2026-09-15" }], "2026-09-30");
    expect(counts).toHaveLength(8);
    expect(counts.at(-1)).toEqual({ weekStart: "2026-09-28", label: "28/09", count: 2 });
    expect(counts.at(-2)!.count).toBe(0);
    expect(counts.at(-3)).toMatchObject({ weekStart: "2026-09-14", count: 1 });
    expect(counts[0]!.weekStart).toBe("2026-08-10");
  });
});

describe("trainingStats", () => {
  it("semana atual, 4 semanas, média e minutos do mês", () => {
    const stats = trainingStats(
      [s("a", "2026-09-29", cardio, 60), s("b", "2026-09-30"), s("c", "2026-09-10"), s("d", "2026-08-31", done, 30)],
      "2026-09-30",
    );
    expect(stats).toEqual({ thisWeek: 2, thisWeekStrength: 1, last4Weeks: 3, weeklyAverage: 0.8, minutesThisMonth: 150 });
  });
});

describe("exerciseProgress", () => {
  const point = (load: string): HistoryPoint => ({ load, reps: ["12"], rir: 2, pain: 0, note: "", skipped: false, date: "2026-09-01", week: 1, kneePainMorning: null, backPainMorning: null });
  it("início, último, melhor e variação (aceita vírgula)", () => {
    expect(exerciseProgress([point("30"), point("42,5"), point("40")])).toEqual({ first: 30, last: 40, best: 42.5, delta: 10, sessions: 3 });
  });
  it("sem carga registrada", () => {
    expect(exerciseProgress([point("")])).toBeNull();
  });
});

describe("formatMinutes", () => {
  it("minutos e horas", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(135)).toBe("2h15");
    expect(formatMinutes(125)).toBe("2h05");
  });
});
