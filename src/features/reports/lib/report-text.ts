import "server-only";
import { formatBRL } from "@/lib/money";
import type { FinanceMonthlyData } from "../generators/finance-monthly";
import { getReportGenerator } from "../registry";
import type { ReportKind } from "../schemas";
import type { ReportBlock } from "./blocks";

/** Texto simples de um `ReportBlock[]` (6.4) — corpo do e-mail/push e entrada do resumo de IA. */
export function blocksToPlainText(blocks: ReportBlock[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    if (block.kind === "cards") {
      lines.push(block.items.map((item) => `${item.label}: ${item.value}`).join(" · "));
    } else if (block.kind === "list") {
      lines.push(block.title);
      for (const row of block.rows) lines.push(`- ${row.label}${row.sublabel ? ` (${row.sublabel})` : ""}${row.value != null ? `: ${row.value}` : ""}`);
    } else if (block.kind === "bars") {
      lines.push(block.title);
      for (const row of block.rows) lines.push(`- ${row.label}: ${row.valueLabel}`);
    } else if (block.kind === "table") {
      lines.push(block.title);
      for (const row of block.rows) lines.push(block.columns.map((col) => `${col.label}: ${row[col.key] ?? ""}`).join(", "));
    } else {
      if (block.title) lines.push(block.title);
      lines.push(block.body);
    }
  }
  return lines.filter(Boolean).join("\n");
}

function financeMonthlyPlainText(data: FinanceMonthlyData): string {
  return [
    `Saldo final: ${formatBRL(data.cards.totalBalanceCents)}`,
    `Entradas: ${formatBRL(data.cards.incomeCents)}`,
    `Saídas: ${formatBRL(data.cards.expenseCents)}`,
    `Resultado: ${formatBRL(data.cards.resultCents)}`,
  ].join("\n");
}

/**
 * Corpo em texto de um relatório já coletado (6.4) — mesma regra de "só
 * `finance_monthly` tem forma própria" já usada pra tela/PDF (`toBlocks`
 * opcional em `ReportGenerator`, 6.2b).
 */
export function reportRunPlainText(kind: ReportKind, data: unknown): string {
  if (kind === "finance_monthly") return financeMonthlyPlainText(data as FinanceMonthlyData);

  const generator = getReportGenerator(kind);
  const blocks = generator?.toBlocks ? generator.toBlocks(data) : [];
  return blocksToPlainText(blocks);
}
