import type { WeeklyReviewReportData } from "@/features/reports/generators/weekly-review-report";
import { formatBRL } from "@/lib/money";

export const WEEKLY_SUMMARY_SYSTEM = [
  "Você escreve os destaques da semana de um sistema pessoal de organização, em português do Brasil.",
  'A partir dos números e listas dados, escreva de 3 a 6 frases corridas (sem markdown, sem bullets) destacando o que mais importa: volume de trabalho, reuniões notáveis, tarefas concluídas — e um alerta se "saídas" superou "entradas", quando esse dado vier.',
  "Não invente números nem fatos que não estejam nos dados fornecidos. Se a semana teve pouca atividade, diga isso em vez de inflar o resumo.",
].join("\n");

/** Mensagem pro Claude (6.8, "Resumo semanal") — mesmos dados do relatório `weekly_review` (6.2b), retrospectivo, sem lançamento por lançamento (só totais). */
export function buildWeeklySummaryMessage(data: WeeklyReviewReportData, periodStart: string, periodEnd: string): string {
  const lines = [
    `Período: ${periodStart} a ${periodEnd}`,
    `Itens criados: ${data.itemsCreatedCount}`,
    `Tarefas concluídas (${data.tasksCompleted.length}): ${data.tasksCompleted.map((task) => task.title).join(", ") || "nenhuma"}`,
    `Reuniões (${data.meetings.length}): ${data.meetings.map((meeting) => meeting.title).join(", ") || "nenhuma"}`,
    `Minutos de estudo: ${data.studyMinutes}`,
  ];

  if (data.financeEnabled) {
    lines.push(`Entradas: ${formatBRL(data.incomeCents)}`, `Saídas: ${formatBRL(data.expenseCents)}`, `Resultado: ${formatBRL(data.resultCents)}`);
  }

  return lines.join("\n");
}
