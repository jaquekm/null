import { describe, expect, it } from "vitest";
import { buildSessionsCsv, buildWeeklyCsv, sessionsInWeek } from "./csv-export";

const session = {
  id: "s1",
  date: "2026-09-28",
  week: 1,
  workout: "A",
  trafficLight: "green",
  sleepHours: 7.5,
  energy: 4,
  kneePainBefore: 0,
  backPainBefore: 1,
  exercises: {
    leg_press_45: { name: "Leg press 45°", load: "42,5", reps: ["12", "12"], rir: 3, pain: 0, note: 'joelho "ok"; firme', skipped: false },
    dead_bug: { name: "Dead bug", load: "", reps: [], rir: null, pain: 0, note: "", skipped: true },
  },
  durationMin: 45,
  kneePainAfter: 0,
  backPainAfter: 0,
  kneePainMorning: null,
  backPainMorning: null,
  notes: "",
};

describe("csv-export", () => {
  it("uma linha por exercício feito, ; como separador, vírgula decimal e aspas escapadas", () => {
    const lines = buildSessionsCsv([session]).split("\n");
    expect(lines).toHaveLength(2); // cabeçalho + leg press (dead bug pulado)
    expect(lines[1]).toBe('2026-09-28;1;A;verde;7,5;4;0;1;Leg press 45°;42,5;12/12;3;0;"joelho ""ok""; firme";45;0;0;;;');
  });

  it("semanal conta os treinos dos 7 dias a partir do início", () => {
    expect(sessionsInWeek([{ date: "2026-09-28" }, { date: "2026-10-04" }, { date: "2026-10-05" }], "2026-09-28")).toBe(2);
    expect(buildWeeklyCsv([{ weekStart: "2026-09-28", weightKg: 62.4, waistCm: null, stepsAvg: 8000 }], [session]).split("\n")[1]).toBe("2026-09-28;62,4;;8000;1");
  });
});
