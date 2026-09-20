import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export interface QuietHoursWindow {
  /** Hora local (0–23) em que o silêncio começa. */
  startHour: number;
  /** Hora local (0–23) em que o silêncio termina. */
  endHour: number;
}

/** Horário silencioso padrão pra terceiros (3.8, `docs/fase-03-...md`): 21h–8h. */
export const DEFAULT_QUIET_HOURS: QuietHoursWindow = { startHour: 21, endHour: 8 };

/** A janela cruza a meia-noite (ex.: 21h–8h): silenciosa se a hora ≥ início OU < fim. */
export function isWithinQuietHours(hour: number, window: QuietHoursWindow = DEFAULT_QUIET_HOURS): boolean {
  return hour >= window.startHour || hour < window.endHour;
}

/**
 * Se `instant` cair no horário silencioso (no fuso `timezone`), devolve as
 * `endHour` (padrão 8h) — do mesmo dia se a hora já estava de madrugada, do
 * dia seguinte se ainda era noite. Fora do horário silencioso, devolve
 * `instant` sem alteração.
 */
export function applyQuietHours(instant: Date, timezone: string, window: QuietHoursWindow = DEFAULT_QUIET_HOURS): Date {
  const hour = Number(formatInTimeZone(instant, timezone, "H"));
  if (!isWithinQuietHours(hour, window)) return instant;

  const dayForShift = hour >= window.startHour ? new Date(instant.getTime() + 24 * 60 * 60 * 1000) : instant;
  const localDate = formatInTimeZone(dayForShift, timezone, "yyyy-MM-dd");
  return fromZonedTime(`${localDate}T${String(window.endHour).padStart(2, "0")}:00:00`, timezone);
}
