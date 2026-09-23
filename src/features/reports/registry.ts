import "server-only";
import { financeMonthlyReport } from "./generators/finance-monthly";
import type { BaseReportParams, ReportKind } from "./schemas";
import type { ReportGenerator } from "./types";

/** Todo relatório "pronto" (6.2/6.2b) — os `kind` que ainda não têm generator caem em `custom` (6.3). */
export const reportRegistry: Partial<Record<ReportKind, ReportGenerator<BaseReportParams, unknown>>> = {
  finance_monthly: financeMonthlyReport as ReportGenerator<BaseReportParams, unknown>,
};

export function getReportGenerator(kind: ReportKind): ReportGenerator<BaseReportParams, unknown> | undefined {
  return reportRegistry[kind];
}
