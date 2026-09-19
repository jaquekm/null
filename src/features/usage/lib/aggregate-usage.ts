import { eachDayOfInterval, format } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export interface UsageEventRow {
  provider: string;
  feature: string;
  costUsd: number | null;
  createdAt: string;
}

export interface UsageBreakdownEntry {
  key: string;
  usd: number;
}

export interface UsageSummary {
  totalUsd: number;
  byProvider: UsageBreakdownEntry[];
  byFeature: UsageBreakdownEntry[];
  /** Um ponto por dia do intervalo, mesmo os sem gasto — pro gráfico ter o mesmo eixo sempre. */
  daily: { date: string; usd: number }[];
}

/**
 * Soma `usage_events` por provedor/recurso/dia (2.3) — função pura, sem
 * tocar no banco, pra dar pra testar isolada. `costUsd: null` (modelo sem
 * preço na tabela, `pricing.ts`) conta como 0 no total, não trava a soma.
 */
export function aggregateUsage(
  rows: UsageEventRow[],
  timezone: string,
  rangeStart: Date,
  rangeEnd: Date,
): UsageSummary {
  const byProvider = new Map<string, number>();
  const byFeature = new Map<string, number>();
  const byDay = new Map<string, number>();
  let totalUsd = 0;

  for (const row of rows) {
    const usd = row.costUsd ?? 0;
    totalUsd += usd;
    byProvider.set(row.provider, (byProvider.get(row.provider) ?? 0) + usd);
    byFeature.set(row.feature, (byFeature.get(row.feature) ?? 0) + usd);

    const day = formatInTimeZone(new Date(row.createdAt), timezone, "yyyy-MM-dd");
    byDay.set(day, (byDay.get(day) ?? 0) + usd);
  }

  // `rangeStart`/`rangeEnd` são instantes UTC de verdade; convertidos pra um
  // "Date zonado" (`toZonedTime`), o `eachDayOfInterval`/`format` do
  // date-fns normal já opera nos dias corretos do fuso local — usar
  // `formatInTimeZone` aqui de novo aplicaria o deslocamento uma segunda
  // vez (o Date já está deslocado) e erraria o rótulo do dia.
  const zonedStart = toZonedTime(rangeStart, timezone);
  const zonedEnd = toZonedTime(rangeEnd, timezone);
  const daily = eachDayOfInterval({ start: zonedStart, end: zonedEnd }).map((date) => {
    const key = format(date, "yyyy-MM-dd");
    return { date: key, usd: byDay.get(key) ?? 0 };
  });

  const toSortedEntries = (map: Map<string, number>): UsageBreakdownEntry[] =>
    [...map.entries()].map(([key, usd]) => ({ key, usd })).sort((a, b) => b.usd - a.usd);

  return {
    totalUsd,
    byProvider: toSortedEntries(byProvider),
    byFeature: toSortedEntries(byFeature),
    daily,
  };
}
