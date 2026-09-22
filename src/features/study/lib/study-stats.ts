import { addDays, formatISO, parseISO } from "date-fns";

/**
 * Estatísticas de revisão (5.7: "taxa de acerto, previsão dos próximos 30
 * dias" — o heatmap de calendário virou um gráfico de barras simples, ver
 * PROGRESSO.md). Funções puras: quem chama já traduz `reviewed_at`/`due_at`
 * pro fuso do dono e devolve a chave `yyyy-MM-dd` (mesmo padrão de
 * `monthPeriod`/`check-budgets`, `date-fns-tz` só na borda).
 */

export interface DailyReviewLog {
  dateKey: string;
  rating: number;
}

/** % de avaliações que não foram "Errei" (rating 1) — 2/3/4 contam como acerto. `null` sem nenhuma revisão ainda. */
export function computeAccuracyRate(logs: { rating: number }[]): number | null {
  if (logs.length === 0) return null;
  const correct = logs.filter((log) => log.rating >= 2).length;
  return Math.round((correct / logs.length) * 100);
}

function dayWindow(todayKey: string, count: number, direction: 1 | -1): string[] {
  const today = parseISO(todayKey);
  const offsets = direction === -1 ? Array.from({ length: count }, (_, i) => -(count - 1 - i)) : Array.from({ length: count }, (_, i) => i);
  return offsets.map((offset) => formatISO(addDays(today, offset), { representation: "date" }));
}

/** Revisões feitas por dia, nos últimos `days` dias (incluindo hoje). */
export function computeReviewsPerDay(logs: DailyReviewLog[], todayKey: string, days: number): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const log of logs) counts.set(log.dateKey, (counts.get(log.dateKey) ?? 0) + 1);
  return dayWindow(todayKey, days, -1).map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

/** Previsão de revisões pros próximos `days` dias (a partir de hoje), a partir das `due_at` dos cards não suspensos. */
export function computeForecast(dueDateKeys: string[], todayKey: string, days: number): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const key of dueDateKeys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return dayWindow(todayKey, days, 1).map((date) => ({ date, count: counts.get(date) ?? 0 }));
}
