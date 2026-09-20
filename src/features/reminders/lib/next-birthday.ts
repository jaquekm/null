import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

function buildOccurrence(year: number, month: number, day: number, hour: number, timezone: string): Date {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate(); // dia 0 do mês seguinte = último dia deste mês
  const clampedDay = Math.min(day, daysInMonth); // 29/02 num ano não bissexto vira 28/02
  const pad = (n: number) => String(n).padStart(2, "0");
  return fromZonedTime(`${year}-${pad(month)}-${pad(clampedDay)}T${pad(hour)}:00:00`, timezone);
}

/**
 * Próxima ocorrência de um aniversário (só o mês/dia de `birthday`,
 * `"YYYY-MM-DD"` — o ano de nascimento é ignorado) às `hour`h no fuso
 * `timezone`, estritamente depois de `after` (3.10, regra "Aniversários").
 * `null` se `birthday` não for uma data válida.
 */
export function nextBirthdayOccurrence(birthday: string, timezone: string, after: Date, hour = 9): Date | null {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(birthday);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const afterYear = Number(formatInTimeZone(after, timezone, "yyyy"));
  for (const year of [afterYear, afterYear + 1]) {
    const candidate = buildOccurrence(year, month, day, hour, timezone);
    if (candidate.getTime() > after.getTime()) return candidate;
  }
  return null;
}
