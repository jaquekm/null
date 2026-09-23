import { formatInTimeZone } from "date-fns-tz";
import { describe, expect, it } from "vitest";
import { nextOccurrence } from "@/features/reminders/lib/recurrence";
import { parseReportSchedule, reportScheduleToRRule } from "./schedule-presets";

const TZ = "America/Sao_Paulo";
const NOW = new Date("2026-09-23T15:00:00.000Z");

describe("reportScheduleToRRule", () => {
  it('"none" não agenda nada', () => {
    expect(reportScheduleToRRule({ kind: "none" }, TZ, NOW)).toBeNull();
  });

  it("monthly_day1_8h: próxima ocorrência sempre cai no dia 1, 8h, no fuso do dono", () => {
    const rrule = reportScheduleToRRule({ kind: "monthly_day1_8h" }, TZ, NOW);
    expect(rrule).not.toBeNull();

    const next = nextOccurrence(rrule!, TZ, NOW);
    expect(next).not.toBeNull();
    expect(formatInTimeZone(next!, TZ, "yyyy-MM-dd HH:mm")).toBe("2026-10-01 08:00");
  });

  it("weekly_monday_7h: próxima ocorrência sempre cai numa segunda, 7h", () => {
    const rrule = reportScheduleToRRule({ kind: "weekly_monday_7h" }, TZ, NOW);
    const next = nextOccurrence(rrule!, TZ, NOW);
    expect(next).not.toBeNull();
    expect(formatInTimeZone(next!, TZ, "yyyy-MM-dd HH:mm EEEE")).toContain("07:00");
    expect(next!.getUTCDay()).toBeDefined();
  });

  it("custom: usa a RRULE informada direto", () => {
    expect(reportScheduleToRRule({ kind: "custom", rrule: "FREQ=DAILY" }, TZ, NOW)).toBe("FREQ=DAILY");
  });

  it("custom vazia vira null (sem agendamento)", () => {
    expect(reportScheduleToRRule({ kind: "custom", rrule: "  " }, TZ, NOW)).toBeNull();
  });
});

describe("parseReportSchedule", () => {
  it("null vira 'none'", () => {
    expect(parseReportSchedule(null)).toEqual({ kind: "none" });
  });

  it("reconhece o preset mensal produzido por reportScheduleToRRule", () => {
    const rrule = reportScheduleToRRule({ kind: "monthly_day1_8h" }, TZ, NOW)!;
    expect(parseReportSchedule(rrule)).toEqual({ kind: "monthly_day1_8h" });
  });

  it("reconhece o preset semanal produzido por reportScheduleToRRule", () => {
    const rrule = reportScheduleToRRule({ kind: "weekly_monday_7h" }, TZ, NOW)!;
    expect(parseReportSchedule(rrule)).toEqual({ kind: "weekly_monday_7h" });
  });

  it("qualquer outra RRULE vira 'custom'", () => {
    expect(parseReportSchedule("RRULE:FREQ=DAILY")).toEqual({ kind: "custom", rrule: "RRULE:FREQ=DAILY" });
  });
});
