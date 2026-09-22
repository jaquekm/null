import { getISOWeek, getISOWeekYear, parseISO } from "date-fns";

/** Rótulo "AAAA-Sxx" (5.8: nome do item "Revisão semanal AAAA-SS") a partir de uma data `yyyy-MM-dd`. */
export function formatWeekLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-S${String(week).padStart(2, "0")}`;
}
