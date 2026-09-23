import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { buildRRuleString, parseRecurrencePreset } from "@/features/reminders/lib/recurrence";

/**
 * Agendamento de relatório (6.4) — só os 3 presets do enunciado, mais estreito
 * que `RecurrencePreset` de lembretes (3.8), que serve qualquer recorrência.
 * Convertido pra `RecurrencePreset` na hora de montar a RRULE (`buildRRuleString`,
 * reaproveitado por inteiro — mesma técnica de fuso "floating").
 */
export type ReportSchedulePreset =
  | { kind: "none" }
  | { kind: "monthly_day1_8h" }
  | { kind: "weekly_monday_7h" }
  | { kind: "custom"; rrule: string };

export const REPORT_SCHEDULE_PRESET_LABELS: Record<ReportSchedulePreset["kind"], string> = {
  none: "Sob demanda",
  monthly_day1_8h: "Todo dia 1º às 8h (mês anterior)",
  weekly_monday_7h: "Toda segunda às 7h (semana anterior)",
  custom: "Personalizado",
};

/** "Hoje às `hour`:00" no fuso do dono, como instante real — ponto de partida (`dtstart`) pra `buildRRuleString`. */
function todayAt(hour: number, timezone: string, now: Date): Date {
  const todayKey = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  return fromZonedTime(`${todayKey}T${String(hour).padStart(2, "0")}:00:00`, timezone);
}

/** Monta a RRULE (com `DTSTART`) a partir do preset — `null` pra "sob demanda" (`report_definitions.schedule_rrule = null`). `now` é injetável só pra teste (mesmo padrão de `runReport`/`resolveRelativePeriod`). */
export function reportScheduleToRRule(preset: ReportSchedulePreset, timezone: string, now: Date = new Date()): string | null {
  if (preset.kind === "none") return null;
  if (preset.kind === "custom") return preset.rrule.trim() || null;
  if (preset.kind === "monthly_day1_8h") return buildRRuleString({ kind: "monthly_day", day: 1 }, todayAt(8, timezone, now), timezone);
  return buildRRuleString({ kind: "weekly", days: ["MO"] }, todayAt(7, timezone, now), timezone);
}

/** Volta de uma RRULE salva pro preset (edição) — só reconhece as duas formas que `reportScheduleToRRule` produz; qualquer outra vira "personalizado". */
export function parseReportSchedule(rruleString: string | null): ReportSchedulePreset {
  if (!rruleString) return { kind: "none" };

  const parsed = parseRecurrencePreset(rruleString);
  if (parsed.kind === "monthly_day" && parsed.day === 1) return { kind: "monthly_day1_8h" };
  if (parsed.kind === "weekly" && parsed.days.length === 1 && parsed.days[0] === "MO") return { kind: "weekly_monday_7h" };
  return { kind: "custom", rrule: rruleString };
}
