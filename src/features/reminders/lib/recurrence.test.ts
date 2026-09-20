import { describe, expect, it } from "vitest";
import { buildRRuleString, nextOccurrence, parseRecurrencePreset, type RecurrencePreset } from "./recurrence";

describe("nextOccurrence", () => {
  it("diariamente, no fuso America/Sao_Paulo (UTC-3, sem horário de verão)", () => {
    const rrule = buildRRuleString({ kind: "daily" }, new Date("2026-01-01T12:00:00.000Z"), "America/Sao_Paulo")!;
    // dtstart 09:00 local (12:00 UTC); depois de 09:00 local do dia 1, a próxima é 09:00 local do dia 2 = 12:00 UTC do dia 2
    const next = nextOccurrence(rrule, "America/Sao_Paulo", new Date("2026-01-01T12:00:00.000Z"));
    expect(next?.toISOString()).toBe("2026-01-02T12:00:00.000Z");
  });

  it("semanalmente em dias específicos", () => {
    const rrule = buildRRuleString({ kind: "weekly", days: ["MO", "WE", "FR"] }, new Date("2026-01-05T12:00:00.000Z"), "America/Sao_Paulo")!; // 2026-01-05 é segunda
    const next = nextOccurrence(rrule, "America/Sao_Paulo", new Date("2026-01-05T12:00:00.000Z"));
    // próxima depois de segunda 09:00 é quarta 09:00 local = 2026-01-07T12:00:00Z
    expect(next?.toISOString()).toBe("2026-01-07T12:00:00.000Z");
  });

  it("mensalmente no dia X", () => {
    const rrule = buildRRuleString({ kind: "monthly_day", day: 15 }, new Date("2026-01-15T12:00:00.000Z"), "America/Sao_Paulo")!;
    const next = nextOccurrence(rrule, "America/Sao_Paulo", new Date("2026-01-15T12:00:00.000Z"));
    expect(next?.toISOString()).toBe("2026-02-15T12:00:00.000Z");
  });

  it("mensalmente na última sexta-feira", () => {
    const rrule = buildRRuleString({ kind: "monthly_last_weekday", day: "FR" }, new Date("2026-01-30T12:00:00.000Z"), "America/Sao_Paulo")!; // 2026-01-30 é a última sexta de janeiro
    const next = nextOccurrence(rrule, "America/Sao_Paulo", new Date("2026-01-30T12:00:00.000Z"));
    // última sexta de fevereiro de 2026 é dia 27
    expect(next?.toISOString()).toBe("2026-02-27T12:00:00.000Z");
  });

  it("anualmente", () => {
    const rrule = buildRRuleString({ kind: "yearly" }, new Date("2026-03-10T12:00:00.000Z"), "America/Sao_Paulo")!;
    const next = nextOccurrence(rrule, "America/Sao_Paulo", new Date("2026-03-10T12:00:00.000Z"));
    expect(next?.toISOString()).toBe("2027-03-10T12:00:00.000Z");
  });

  it("regra sem mais ocorrências (COUNT esgotado): null", () => {
    const next = nextOccurrence("DTSTART:20260101T090000Z\nRRULE:FREQ=DAILY;COUNT=1", "America/Sao_Paulo", new Date("2026-01-05T12:00:00.000Z"));
    expect(next).toBeNull();
  });

  it("string de RRULE inválida: null, não lança", () => {
    expect(() => nextOccurrence("isso não é um RRULE", "America/Sao_Paulo", new Date())).not.toThrow();
    expect(nextOccurrence("isso não é um RRULE", "America/Sao_Paulo", new Date())).toBeNull();
  });

  it("atravessa a virada de horário de verão (America/New_York) mantendo a hora local", () => {
    // DTSTART antes da virada de DST dos EUA em 2026 (8 de março); diário às 09:00 local
    const rrule = buildRRuleString({ kind: "daily" }, new Date("2026-03-05T14:00:00.000Z"), "America/New_York")!; // 09:00 EST (UTC-5)
    // pede a ocorrência depois do dia 9 de março (já em horário de verão, UTC-4)
    const next = nextOccurrence(rrule, "America/New_York", new Date("2026-03-09T13:00:00.000Z"));
    // 09:00 local em 10/mar já em EDT (UTC-4) = 13:00 UTC — continua 09:00 na parede, não 08:00
    expect(next?.toISOString()).toBe("2026-03-10T13:00:00.000Z");
  });
});

describe("buildRRuleString", () => {
  it("'uma vez' não tem RRULE", () => {
    expect(buildRRuleString({ kind: "once" }, new Date(), "America/Sao_Paulo")).toBeNull();
  });

  it("'personalizado' devolve a string exatamente como veio", () => {
    const custom = "DTSTART:20260101T090000Z\nRRULE:FREQ=DAILY;INTERVAL=3";
    expect(buildRRuleString({ kind: "custom", rrule: custom }, new Date(), "America/Sao_Paulo")).toBe(custom);
  });

  it("inclui DTSTART com a hora local certa (não a hora UTC crua)", () => {
    // 2026-01-01T12:00:00Z = 09:00 em São Paulo
    const rrule = buildRRuleString({ kind: "daily" }, new Date("2026-01-01T12:00:00.000Z"), "America/Sao_Paulo")!;
    expect(rrule).toContain("DTSTART:20260101T090000Z");
  });
});

describe("parseRecurrencePreset", () => {
  it("null vira 'once'", () => {
    expect(parseRecurrencePreset(null)).toEqual({ kind: "once" });
  });

  it("RRULE sem a linha 'RRULE:' vira 'custom'", () => {
    expect(parseRecurrencePreset("DTSTART:20260101T090000Z")).toEqual({
      kind: "custom",
      rrule: "DTSTART:20260101T090000Z",
    });
  });

  const dtstart = new Date("2026-01-01T12:00:00.000Z");
  const timezone = "America/Sao_Paulo";
  const roundTripCases: RecurrencePreset[] = [
    { kind: "daily" },
    { kind: "weekdays" },
    { kind: "weekly", days: ["MO", "WE", "FR"] },
    { kind: "monthly_day", day: 15 },
    { kind: "monthly_last_weekday", day: "FR" },
    { kind: "yearly" },
  ];

  for (const preset of roundTripCases) {
    it(`round-trip: ${preset.kind}`, () => {
      const rrule = buildRRuleString(preset, dtstart, timezone)!;
      expect(parseRecurrencePreset(rrule)).toEqual(preset);
    });
  }

  it("RRULE personalizada (não gerada por buildRRuleString) vira 'custom'", () => {
    const custom = "DTSTART:20260101T090000Z\nRRULE:FREQ=DAILY;INTERVAL=3";
    expect(parseRecurrencePreset(custom)).toEqual({ kind: "custom", rrule: custom });
  });
});
