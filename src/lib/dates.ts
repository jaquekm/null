import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/**
 * Dia (`yyyy-MM-dd`) de `date` no fuso informado. `date.toISOString().slice(0, 10)`
 * dá o dia em UTC — em Brasília, depois das 21h já é "amanhã" — e foi a origem
 * de datas padrão erradas em vários formulários e jobs. Sem fuso, usa o padrão
 * do app, que é o mesmo no servidor e no navegador (sem divergência na hidratação).
 */
export function dateInTimezone(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

export function todayInTimezone(timezone: string = DEFAULT_TIMEZONE, now: Date = new Date()): string {
  return dateInTimezone(now, timezone);
}

const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/**
 * `<input type="datetime-local">` devolve hora de relógio sem fuso
 * (`2026-09-28T14:00`); o campo `datetime` guarda ISO com fuso. Sem esta
 * conversão o valor era recusado pela validação e o campo nunca salvava.
 * Valor que já é ISO com fuso passa intacto.
 */
export function wallClockToIso(value: string, timezone: string = DEFAULT_TIMEZONE): string {
  if (!WALL_CLOCK.test(value)) return value;
  return fromZonedTime(value, timezone).toISOString();
}

/** Inverso de `wallClockToIso`, pro valor inicial do `datetime-local` (cortar o ISO mostraria a hora UTC). */
export function isoToWallClock(iso: string, timezone: string = DEFAULT_TIMEZONE): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatInTimeZone(date, timezone, "yyyy-MM-dd'T'HH:mm");
}

/** Soma dias a uma data `yyyy-MM-dd` como calendário puro (sem hora, sem fuso). */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
