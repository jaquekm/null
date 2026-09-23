import { getReportGenerator } from "../registry";
import type { FinanceMonthlyData } from "../generators/finance-monthly";
import type { ReportKind } from "../schemas";
import { FinanceMonthlyReport } from "./finance-monthly-report";
import { GenericReportView } from "./generic-report-view";

/**
 * Tela de uma execução já coletada (`report_runs.data`, 6.4) — usada pela
 * tela autenticada (`/relatorios/execucoes/[id]`) e pela página pública
 * (`/p/[token]`, "renderiza somente o snapshot"), mesmo componente pros
 * dois porque os dois mostram exatamente o mesmo snapshot. Mesma regra de
 * "só `finance_monthly` tem forma própria" já usada no PDF (`render-pdf.tsx`).
 */
export function ReportRunView({ kind, title, subtitle, data }: { kind: ReportKind; title: string; subtitle: string; data: unknown }) {
  if (kind === "finance_monthly") return <FinanceMonthlyReport data={data as FinanceMonthlyData} />;

  const generator = getReportGenerator(kind);
  const blocks = generator?.toBlocks ? generator.toBlocks(data) : [];
  return <GenericReportView title={title} subtitle={subtitle} blocks={blocks} />;
}
