import "server-only";
import { billsForecastReport } from "./generators/bills-forecast";
import { customReport } from "./generators/custom";
import { financeCategoryReport } from "./generators/finance-category";
import { financeMonthlyReport } from "./generators/finance-monthly";
import { meetingsDigestReport } from "./generators/meetings-digest";
import { projectsStatusReport } from "./generators/projects-status";
import { salesPipelineReport } from "./generators/sales-pipeline";
import { splitsStatementReport } from "./generators/splits-statement";
import { studyProgressReport } from "./generators/study-progress";
import { weeklyReviewReport } from "./generators/weekly-review-report";
import type { BaseReportParams, ReportKind } from "./schemas";
import type { ReportGenerator } from "./types";

/** Todo relatório "pronto" (6.2/6.2b) mais o construtor de personalizados (6.3, `kind: "custom"`). */
export const reportRegistry: Partial<Record<ReportKind, ReportGenerator<BaseReportParams, unknown>>> = {
  finance_monthly: financeMonthlyReport as ReportGenerator<BaseReportParams, unknown>,
  custom: customReport as unknown as ReportGenerator<BaseReportParams, unknown>,
  finance_category: financeCategoryReport as unknown as ReportGenerator<BaseReportParams, unknown>,
  bills_forecast: billsForecastReport as ReportGenerator<BaseReportParams, unknown>,
  splits_statement: splitsStatementReport as unknown as ReportGenerator<BaseReportParams, unknown>,
  sales_pipeline: salesPipelineReport as ReportGenerator<BaseReportParams, unknown>,
  projects_status: projectsStatusReport as ReportGenerator<BaseReportParams, unknown>,
  study_progress: studyProgressReport as ReportGenerator<BaseReportParams, unknown>,
  meetings_digest: meetingsDigestReport as unknown as ReportGenerator<BaseReportParams, unknown>,
  weekly_review: weeklyReviewReport as ReportGenerator<BaseReportParams, unknown>,
};

export function getReportGenerator(kind: ReportKind): ReportGenerator<BaseReportParams, unknown> | undefined {
  return reportRegistry[kind];
}
