import { formatInTimeZone } from "date-fns-tz";

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

/** Soma dias a uma data `yyyy-MM-dd` como calendário puro (sem hora, sem fuso). */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
