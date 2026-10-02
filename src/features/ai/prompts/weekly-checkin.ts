import type { WeeklyCheckinData } from "@/features/weekly-checkin/queries";
import { formatBRL } from "@/lib/money";

export const WEEKLY_CHECKIN_SYSTEM = [
  "Você escreve uma frase só de resumo da semana de um sistema pessoal de saúde e hábitos, em português do Brasil.",
  "Escreva EXATAMENTE uma frase corrida (sem markdown, sem bullets), direta, destacando o ponto mais importante dos dados — o que foi bem ou o que precisa de atenção (ex.: remédios esquecidos, orçamento passado, hábitos consistentes).",
  "Não invente números nem fatos que não estejam nos dados fornecidos. Se faltar um dado, simplesmente não fale dele.",
].join("\n");

/**
 * Mensagem pro Claude (10.16, "frase de resumo da IA" da revisão semanal
 * automática). `includeBudget` separado do dado em si (`data.budget`) —
 * dados financeiros só entram no prompt com o módulo de IA de Finanças
 * ligado (`isFinanceAiEnabled`), mesmo que o orçamento já esteja calculado
 * pra mostrar na tela sem IA nenhuma.
 */
export function buildWeeklyCheckinMessage(data: WeeklyCheckinData, includeBudget: boolean): string {
  const lines: string[] = [];

  if (data.habits) lines.push(`Hábitos: ${data.habits.done} de ${data.habits.scheduled} marcações feitas essa semana.`);
  lines.push(`Treinos: ${data.workoutsCount} sessão(ões) essa semana.`);
  if (data.weight) {
    const trend = data.weight.previousKg != null ? ` (semana anterior: ${data.weight.previousKg} kg)` : "";
    lines.push(`Peso: ${data.weight.currentKg} kg${trend}.`);
  }
  if (data.medications.length > 0) {
    lines.push(
      `Remédios: ${data.medications.map((m) => `${m.name} — ${m.takenDoses} de ${m.expectedDoses} doses, ${m.missedDoses} esquecida(s)`).join("; ")}.`,
    );
  }
  if (includeBudget && data.budget) {
    const overLabel = data.budget.overCategories.length > 0 ? `, passou do limite em: ${data.budget.overCategories.join(", ")}` : "";
    lines.push(`Orçamento do mês: gastou ${formatBRL(data.budget.spentCents)} de ${formatBRL(data.budget.budgetCents)} planejados${overLabel}.`);
  }

  return lines.join("\n");
}
