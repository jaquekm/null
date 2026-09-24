const BOM = "﻿";

/** Mesma regra de `financas/lib/export-csv.ts` (separador `;`) — aspas em volta se houver `;`, `"` ou quebra de linha, aspas internas dobradas. */
export function csvEscape(value: string): string {
  if (/[";\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Monta um CSV `;`-separado com BOM UTF-8 na frente (abre certo no Excel) e `\r\n` — mesmo padrão do export de lançamentos (4.13). */
export function buildCsv(header: string[], rows: string[][]): string {
  const lines = [header.join(";"), ...rows.map((row) => row.map(csvEscape).join(";"))];
  return BOM + lines.join("\r\n");
}
