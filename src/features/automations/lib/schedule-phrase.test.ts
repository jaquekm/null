import { describe, expect, it } from "vitest";
import { nextOccurrence } from "@/features/reminders/lib/recurrence";
import { describeScheduleRrule, scheduleFromPhrase } from "./schedule-phrase";

const TZ = "America/Sao_Paulo";
// Quarta, 30/09/2026, 10:00 em São Paulo.
const NOW = new Date("2026-09-30T13:00:00Z");

function ok(text: string) {
  const result = scheduleFromPhrase(text, NOW, TZ);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("scheduleFromPhrase", () => {
  it.each([
    ["toda sexta às 17h", "toda sexta às 17:00"],
    ["todo dia às 7h", "todo dia às 07:00"],
    ["de segunda a sexta às 8h", "de segunda a sexta às 08:00"],
    ["todo dia 10", "todo dia 10 às 09:00"],
    ["todas as segundas e quartas às 7h30", "às segundas e quartas às 07:30"],
  ])("%s → %s", (text, description) => {
    expect(ok(text).description).toBe(description);
  });

  it("grava o DTSTART na primeira ocorrência futura, no fuso", () => {
    const { rrule } = ok("toda sexta às 17h");
    expect(rrule).toBe("DTSTART:20261002T170000Z\nRRULE:FREQ=WEEKLY;BYDAY=FR");
    expect(nextOccurrence(rrule, TZ, new Date(0))?.toISOString()).toBe("2026-10-02T20:00:00.000Z");
  });

  it("recusa frase sem repetição ou sem data", () => {
    expect(scheduleFromPhrase("amanhã às 9h", NOW, TZ)).toMatchObject({ ok: false, error: expect.stringContaining("repete") });
    expect(scheduleFromPhrase("fazer algo", NOW, TZ)).toMatchObject({ ok: false, error: expect.stringContaining("Não entendi") });
    expect(scheduleFromPhrase("   ", NOW, TZ)).toMatchObject({ ok: false });
  });
});

describe("describeScheduleRrule", () => {
  it("lê de volta o que scheduleFromPhrase grava", () => {
    for (const text of ["toda sexta às 17h", "todo dia 31 às 8h", "de segunda a sexta às 7h", "toda última sexta do mês às 18h"]) {
      const { rrule, description } = ok(text);
      expect(describeScheduleRrule(rrule), text).toBe(description);
    }
  });

  it("regra dos packs, sem DTSTART, sai sem hora", () => {
    expect(describeScheduleRrule("FREQ=WEEKLY;BYDAY=MO")).toBe("toda segunda");
    expect(describeScheduleRrule("RRULE:FREQ=DAILY")).toBe("todo dia");
  });

  it("forma desconhecida → null", () => {
    expect(describeScheduleRrule("FREQ=HOURLY;INTERVAL=2")).toBeNull();
  });
});
