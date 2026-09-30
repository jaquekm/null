import { describe, expect, it } from "vitest";
import {
  completionLevel,
  consistencyHeatmap,
  dayCompletion,
  describeFrequency,
  frequencyFromWeekdays,
  habitStreak,
  isScheduled,
  perfectDaysStreak,
  scheduledWeekdays,
  startOfWeek,
  weekDates,
  weekdayOf,
  type HabitForWeek,
} from "./habit-week";

// Quarta, 30/09/2026.
const TODAY = "2026-09-30";

function habit(overrides: Partial<HabitForWeek> = {}): HabitForWeek {
  return { id: "h", title: "Água", log: {}, frequency: null, since: "2026-01-01", ...overrides };
}
const logged = (...dates: string[]) => Object.fromEntries(dates.map((d) => [d, true]));

describe("semana", () => {
  it("dia da semana e segunda-feira da semana", () => {
    expect(weekdayOf(TODAY)).toBe("WE");
    expect(weekdayOf("2026-10-04")).toBe("SU");
    expect(startOfWeek(TODAY)).toBe("2026-09-28");
    expect(startOfWeek("2026-10-04")).toBe("2026-09-28");
    expect(weekDates(TODAY)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
  });
});

describe("frequência", () => {
  it.each([
    [null, null],
    ["", null],
    ["FREQ=DAILY", null],
    ["FREQ=WEEKLY;BYDAY=MO,WE,FR", ["MO", "WE", "FR"]],
    ["seg, qua e sex", ["MO", "WE", "FR"]],
    ["sábado e domingo", ["SA", "SU"]],
    ["qualquer coisa", null],
  ])("%j → %j", (frequency, days) => {
    const result = scheduledWeekdays(frequency);
    expect(result ? [...result] : null).toEqual(days);
  });

  it("monta e descreve", () => {
    expect(frequencyFromWeekdays(["FR", "MO"])).toBe("FREQ=WEEKLY;BYDAY=MO,FR");
    expect(frequencyFromWeekdays([])).toBe("FREQ=DAILY");
    expect(frequencyFromWeekdays(["MO", "TU", "WE", "TH", "FR", "SA", "SU"])).toBe("FREQ=DAILY");
    expect(describeFrequency("FREQ=DAILY")).toBe("todo dia");
    expect(describeFrequency("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")).toBe("dias úteis");
    expect(describeFrequency("FREQ=WEEKLY;BYDAY=SA,SU")).toBe("fins de semana");
    expect(describeFrequency("FREQ=WEEKLY;BYDAY=MO,FR")).toBe("seg, sex");
  });

  it("antes de começar não conta", () => {
    expect(isScheduled(habit({ since: "2026-09-30" }), "2026-09-29")).toBe(false);
    expect(isScheduled(habit({ frequency: "FREQ=WEEKLY;BYDAY=MO" }), TODAY)).toBe(false);
  });
});

describe("habitStreak", () => {
  it("conta dias seguidos até hoje", () => {
    expect(habitStreak(habit({ log: logged("2026-09-28", "2026-09-29", "2026-09-30") }), TODAY)).toBe(3);
  });

  it("hoje ainda sem marcar não quebra", () => {
    expect(habitStreak(habit({ log: logged("2026-09-28", "2026-09-29") }), TODAY)).toBe(2);
  });

  it("um dia sem fazer quebra", () => {
    expect(habitStreak(habit({ log: logged("2026-09-27", "2026-09-29") }), TODAY)).toBe(1);
  });

  it("dia fora da frequência não quebra", () => {
    // seg/qua/sex: sex 25, seg 28, qua 30 feitos; ter 29 e fim de semana não contam.
    const h = habit({ frequency: "FREQ=WEEKLY;BYDAY=MO,WE,FR", log: logged("2026-09-25", "2026-09-28", "2026-09-30") });
    expect(habitStreak(h, TODAY)).toBe(3);
  });

  it("para no dia em que começou", () => {
    expect(habitStreak(habit({ since: "2026-09-29", log: logged("2026-09-29", "2026-09-30") }), TODAY)).toBe(2);
  });
});

describe("dias completos e mapa", () => {
  const water = habit({ id: "a", log: logged("2026-09-28", "2026-09-29", "2026-09-30") });
  const gym = habit({ id: "b", title: "Treinar", frequency: "FREQ=WEEKLY;BYDAY=MO,WE,FR", log: logged("2026-09-28", "2026-09-30") });
  const read = habit({ id: "c", title: "Ler", log: logged("2026-09-29") });

  it("dia completo = tudo que estava marcado pro dia", () => {
    expect(dayCompletion([water, gym, read], "2026-09-29")).toEqual({ done: 2, scheduled: 2 });
    expect(dayCompletion([water, gym, read], "2026-09-28")).toEqual({ done: 2, scheduled: 3 });
    expect(perfectDaysStreak([water, gym], TODAY)).toBe(3);
    expect(perfectDaysStreak([water, gym, read], TODAY)).toBe(1); // hoje falta ler, mas hoje não quebra; ontem completo; segunda não
  });

  it("nível do dia", () => {
    expect(completionLevel({ done: 0, scheduled: 3 })).toBe(0);
    expect(completionLevel({ done: 1, scheduled: 4 })).toBe(1);
    expect(completionLevel({ done: 1, scheduled: 2 })).toBe(2);
    expect(completionLevel({ done: 3, scheduled: 4 })).toBe(3);
    expect(completionLevel({ done: 2, scheduled: 2 })).toBe(4);
    expect(completionLevel({ done: 0, scheduled: 0 })).toBe(0);
  });

  it("16 semanas de segunda a domingo, futuro marcado", () => {
    const map = consistencyHeatmap([water, gym], TODAY);
    expect(map).toHaveLength(16);
    expect(map.every((week) => week.length === 7)).toBe(true);
    const last = map[15]!;
    expect(last[0]).toMatchObject({ date: "2026-09-28", level: 4 });
    expect(last[2]).toMatchObject({ date: TODAY, level: 4 });
    expect(last[3]).toMatchObject({ date: "2026-10-01", level: -1 });
    expect(map[0]![0]!.date).toBe("2026-06-15");
  });
});
