import type { FieldDefinition, FieldType } from "@/features/types/schemas";
import { formatPropertyValue } from "./format-property-value";

/**
 * Linha de totais da Tabela (9.6): por coluna numérica, soma, média ou
 * contagem — sobre **todas** as linhas do filtro, não só a página (o
 * servidor manda `sum`/`count` de cada coluna; a escolha do cálculo é do
 * navegador e fica salva na visão).
 */
export const TOTAL_AGGS = ["sum", "avg", "count", "none"] as const;
export type TotalAgg = (typeof TOTAL_AGGS)[number];

export const TOTAL_AGG_LABELS: Record<TotalAgg, string> = { sum: "Soma", avg: "Média", count: "Contagem", none: "—" };

const TOTALABLE: FieldType[] = ["number", "money", "percent", "rating", "duration", "rollup", "formula"];

export function isTotalable(field: FieldDefinition): boolean {
  return TOTALABLE.includes(field.type);
}

/** Nota e porcentagem fazem mais sentido em média; o resto, em soma. */
export function defaultAgg(field: FieldDefinition): TotalAgg {
  if (field.type === "rating" || field.type === "percent") return "avg";
  if (field.type === "formula" && field.formulaFormat === "percent") return "avg";
  if (field.type === "rollup" && field.rollupOp === "percent") return "avg";
  return "sum";
}

export interface ColumnSummary {
  sum: number;
  /** Quantas linhas têm valor nessa coluna. */
  count: number;
}

function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function summarizeColumns(rows: Record<string, unknown>[], fields: FieldDefinition[]): Record<string, ColumnSummary> {
  const summary: Record<string, ColumnSummary> = {};
  for (const field of fields) {
    if (!isTotalable(field)) continue;
    let sum = 0;
    let count = 0;
    for (const properties of rows) {
      const value = numeric(properties[field.key]);
      if (value === null) continue;
      sum += value;
      count += 1;
    }
    summary[field.key] = { sum, count };
  }
  return summary;
}

export function totalValue(summary: ColumnSummary | undefined, agg: TotalAgg): number | null {
  if (!summary || agg === "none") return null;
  if (agg === "count") return summary.count;
  if (agg === "sum") return summary.count === 0 ? null : summary.sum;
  return summary.count === 0 ? null : summary.sum / summary.count;
}

/** Total no formato da coluna (dinheiro em R$, porcentagem com %); contagem é só o número. */
export function formatTotal(summary: ColumnSummary | undefined, agg: TotalAgg, field: FieldDefinition): string {
  const value = totalValue(summary, agg);
  if (value === null) return agg === "none" ? "" : "—";
  if (agg === "count") return value.toLocaleString("pt-BR");
  const isMoney = field.type === "money" || (field.type === "formula" && field.formulaFormat === "money");
  // Dinheiro é inteiro em centavos: a média arredonda pro centavo.
  const rounded = isMoney ? Math.round(value) : Math.round(value * 100) / 100;
  if (field.type === "number" || field.type === "rating" || field.type === "duration" || (field.type === "rollup" && field.rollupOp !== "percent")) {
    return rounded.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }
  if (field.type === "percent") return `${rounded.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  return formatPropertyValue(rounded, field);
}
