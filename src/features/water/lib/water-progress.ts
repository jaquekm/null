import { addDaysToDateString } from "@/lib/dates";

export interface WaterDayTotal {
  day: string;
  totalMl: number;
}

/** Progresso da meta diária (10.4), sempre entre 0 e 100 — nunca passa da barra mesmo bebendo mais que a meta. */
export function waterProgressPercent(totalMl: number, goalMl: number): number {
  if (goalMl <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((totalMl / goalMl) * 100)));
}

/** Histórico da semana (10.4) — sempre `days` dias terminando em `todayStr` (inclusive), preenchendo com 0 ml o dia sem registro (nenhum copo bebido, não "sem dado"). */
export function fillWaterHistory(rows: WaterDayTotal[], days: number, todayStr: string): WaterDayTotal[] {
  const totalByDay = new Map(rows.map((row) => [row.day, row.totalMl]));
  const result: WaterDayTotal[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDaysToDateString(todayStr, -i);
    result.push({ day, totalMl: totalByDay.get(day) ?? 0 });
  }
  return result;
}

const DAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"]; // domingo…sábado, na ordem de Date#getUTCDay()

/** Letra do dia da semana (10.4, tira da semana no card de Água) — calendário puro em UTC, sem ler o relógio. */
export function weekdayLetter(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const weekday = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
  return DAY_LETTERS[weekday] ?? "";
}
