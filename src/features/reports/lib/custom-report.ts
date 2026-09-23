export const metricKinds = ["count", "sum", "avg", "min", "max"] as const;
export type MetricKind = (typeof metricKinds)[number];

export const visualizations = ["table", "bars", "line", "donut", "number"] as const;
export type Visualization = (typeof visualizations)[number];

/** Uma linha de origem (item/lançamento) já traduzida pra um grupo — `multi_select`/`relation` múltiplo gera uma `GroupableRow` por chave, mesmo `sourceId`. */
export interface GroupableRow {
  sourceId: string;
  groupKey: string;
  groupLabel: string;
  /** Valor do campo de métrica pra essa linha; `null` quando o campo está vazio (não entra em soma/média/mín/máx, mas conta pra `count`). */
  metricValue: number | null;
}

export interface AggregatedGroup {
  key: string;
  label: string;
  count: number;
  value: number;
}

/**
 * Agrupa e agrega (6.3: "contagem, soma/média/mín/máx") — função pura, o
 * `collect()` do relatório monta as `GroupableRow[]` a partir de itens ou
 * lançamentos e chama isto uma vez por seção. Ordena pelo maior `value`
 * primeiro (mais útil em barra/tabela do que ordem de chegada).
 */
export function aggregateGroups(rows: GroupableRow[], metric: MetricKind): AggregatedGroup[] {
  const byKey = new Map<string, { label: string; count: number; values: number[] }>();
  for (const row of rows) {
    const bucket = byKey.get(row.groupKey) ?? { label: row.groupLabel, count: 0, values: [] };
    bucket.count += 1;
    if (row.metricValue != null) bucket.values.push(row.metricValue);
    byKey.set(row.groupKey, bucket);
  }

  return [...byKey.entries()]
    .map(([key, bucket]) => ({ key, label: bucket.label, count: bucket.count, value: computeMetricValue(bucket.values, bucket.count, metric) }))
    .sort((a, b) => b.value - a.value);
}

function computeMetricValue(values: number[], count: number, metric: MetricKind): number {
  switch (metric) {
    case "count":
      return count;
    case "sum":
      return values.reduce((sum, v) => sum + v, 0);
    case "avg":
      return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
    case "min":
      return values.length === 0 ? 0 : Math.min(...values);
    case "max":
      return values.length === 0 ? 0 : Math.max(...values);
    default: {
      const exhaustive: never = metric;
      throw new Error(`Métrica desconhecida: ${String(exhaustive)}`);
    }
  }
}

/** yyyy-MM-dd -> chave/rótulo do balde de período (6.3: "dia, semana, mês") — semana começa na segunda (ISO), mesmo critério do resto do app. */
export function periodBucket(dateKey: string, granularity: "day" | "week" | "month"): { key: string; label: string } {
  if (granularity === "day") return { key: dateKey, label: dateKey };
  if (granularity === "month") {
    const key = dateKey.slice(0, 7);
    return { key, label: key };
  }
  const date = new Date(`${dateKey}T12:00:00Z`);
  const isoDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - (isoDay - 1));
  const key = monday.toISOString().slice(0, 10);
  return { key, label: `Semana de ${key}` };
}
