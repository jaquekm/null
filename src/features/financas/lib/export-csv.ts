import type { Cents } from "@/lib/money";

export interface TransactionForCsv {
  occurredOn: string;
  description: string;
  amountCents: Cents;
  categoryName: string | null;
  accountName: string;
  contactName: string | null;
  tags: string[];
}

const HEADER = ["Data", "Descrição", "Valor", "Categoria", "Conta", "Contato", "Tags"];

function csvEscape(value: string): string {
  if (/[";\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** `123456 → "1234,56"` — decimal vírgula, sem separador de milhar (número simples de reabrir). */
function formatCsvAmount(cents: Cents): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * CSV de lançamentos (4.13) — separador `;` e decimal `,` (padrão do Excel
 * em pt-BR); o BOM UTF-8 (`﻿`) fica por conta de quem grava/serve o
 * arquivo, não desta função (ela só monta o texto).
 */
export function buildTransactionsCsv(rows: TransactionForCsv[]): string {
  const lines = [HEADER.join(";")];
  for (const row of rows) {
    lines.push(
      [
        row.occurredOn,
        csvEscape(row.description),
        formatCsvAmount(row.amountCents),
        csvEscape(row.categoryName ?? ""),
        csvEscape(row.accountName),
        csvEscape(row.contactName ?? ""),
        csvEscape(row.tags.join(", ")),
      ].join(";"),
    );
  }
  return lines.join("\r\n");
}
