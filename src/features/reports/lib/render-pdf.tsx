import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { FinanceMonthlyPdf } from "../components/finance-monthly-pdf";
import { GenericReportPdf } from "../components/generic-report-pdf";
import type { FinanceMonthlyData } from "../generators/finance-monthly";
import { getReportGenerator } from "../registry";
import type { ReportKind } from "../schemas";

/**
 * PDF de uma execução já coletada (6.4, job `generate_report`) — mesma regra
 * de "só `finance_monthly` tem componente próprio" da tela (6.2/6.2b).
 * `renderToBuffer` já validado rodando dentro do runtime do Next (mesma nota
 * de `finance-monthly-pdf.test.tsx`, 6.2): funciona no Vitest e no bundle do
 * Next/Turbopack, não via `tsx` direto.
 */
export async function renderReportPdf(kind: ReportKind, title: string, subtitle: string, data: unknown): Promise<Buffer> {
  if (kind === "finance_monthly") {
    return renderToBuffer(<FinanceMonthlyPdf data={data as FinanceMonthlyData} />);
  }

  const generator = getReportGenerator(kind);
  const blocks = generator?.toBlocks ? generator.toBlocks(data) : [];
  return renderToBuffer(<GenericReportPdf title={title} subtitle={subtitle} blocks={blocks} />);
}
