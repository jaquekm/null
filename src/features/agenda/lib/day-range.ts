import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export interface DayRange {
  startIso: string;
  endIsoExclusive: string;
  dateStr: string;
}

/** Início/fim (exclusivo) do dia de `referenceDate` **no fuso do dono** (3.6), convertidos pra UTC. */
export function computeDayRange(referenceDate: Date, timezone: string): DayRange {
  const dateStr = formatInTimeZone(referenceDate, timezone, "yyyy-MM-dd");
  const start = fromZonedTime(`${dateStr}T00:00:00`, timezone);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIsoExclusive: end.toISOString(), dateStr };
}
