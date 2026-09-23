export type ReportTone = "emerald" | "red" | "default";
export type BudgetStatus = "under" | "warning" | "over";

export interface ReportCardItem {
  label: string;
  value: string;
  tone?: ReportTone;
}

export interface ReportListRow {
  label: string;
  sublabel?: string;
  value?: string;
  tone?: ReportTone;
}

export interface ReportBarRow {
  label: string;
  valueLabel: string;
  percent: number;
  status?: BudgetStatus | null;
}

export interface ReportTableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}

export type ReportBlock =
  | { kind: "cards"; items: ReportCardItem[] }
  | { kind: "list"; title: string; rows: ReportListRow[]; emptyText?: string }
  | { kind: "bars"; title: string; rows: ReportBarRow[]; emptyText?: string }
  | { kind: "table"; title: string; columns: ReportTableColumn[]; rows: Record<string, string>[]; emptyText?: string }
  | { kind: "text"; title?: string; body: string };

/** Cor por status de orçamento/progresso (0–80% ok, 80–100% atenção, >100% estourado) — mesmo critério da 4.11. */
export function budgetStatusFromPercent(percent: number): BudgetStatus {
  if (percent > 100) return "over";
  if (percent >= 80) return "warning";
  return "under";
}
