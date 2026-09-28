import { splitCsvLine } from "@/features/financas/lib/parse-statement-csv";
import type { ParsedImportItem, ParsedImportResult } from "../types";

export const SPREADSHEET_COLUMN_ROLES = ["ignore", "title", "category", "subcategory", "body"] as const;
export type SpreadsheetColumnRole = (typeof SPREADSHEET_COLUMN_ROLES)[number];

export const SPREADSHEET_DELIMITERS = [",", ";"] as const;
export type SpreadsheetDelimiter = (typeof SPREADSHEET_DELIMITERS)[number];

export interface SpreadsheetImportMapping {
  delimiter: SpreadsheetDelimiter;
  /** Um `SpreadsheetColumnRole` por índice de coluna, na ordem em que aparecem na primeira linha (cabeçalho). */
  columns: SpreadsheetColumnRole[];
}

/** Primeira linha do arquivo → nomes de coluna, pra tela de mapeamento mostrar algo melhor que "Coluna 1". */
export function readSpreadsheetHeaders(text: string, delimiter: SpreadsheetDelimiter): string[] {
  const firstLine = text.split(/\r\n|\r|\n/).find((line) => line.trim() !== "");
  return firstLine ? splitCsvLine(firstLine, delimiter) : [];
}

/**
 * Origem "Planilha" do assistente de importação: qualquer `.csv` com
 * cabeçalho na primeira linha vira itens, um por linha — diferente do CSV de
 * extrato bancário (colunas fixas: data/valor) ou do CSV de contatos (campos
 * fixos de contato), aqui o dono escolhe livremente qual coluna é o título,
 * categoria, subcategoria, ou uma linha a mais no corpo do item. Pensado pra
 * planilhas do tipo "lista de tarefas de uma mudança de casa", com categoria
 * e subcategoria próprias por linha.
 */
export function parseSpreadsheetCsv(text: string, mapping: SpreadsheetImportMapping): ParsedImportResult {
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return { items: [], warnings: ["A planilha está vazia."] };

  const headers = splitCsvLine(lines[0]!, mapping.delimiter);
  const dataLines = lines.slice(1);

  const items: ParsedImportItem[] = [];
  const warnings: string[] = [];
  let skippedWithoutTitle = 0;

  dataLines.forEach((line, index) => {
    const fields = splitCsvLine(line, mapping.delimiter);
    let title = "";
    let categoryLabel: string | null = null;
    let subcategoryLabel: string | null = null;
    const bodyLines: string[] = [];

    mapping.columns.forEach((role, columnIndex) => {
      const raw = (fields[columnIndex] ?? "").trim();
      if (!raw) return;

      if (role === "title") title = title ? `${title} ${raw}` : raw;
      else if (role === "category") categoryLabel = raw;
      else if (role === "subcategory") subcategoryLabel = raw;
      else if (role === "body") bodyLines.push(`${headers[columnIndex]?.trim() || `Coluna ${columnIndex + 1}`}: ${raw}`);
    });

    if (!title) {
      skippedWithoutTitle++;
      return;
    }

    items.push({
      localId: `planilha-${index}`,
      title,
      bodyMarkdown: bodyLines.join("\n"),
      tags: [],
      createdAt: null,
      updatedAt: null,
      attachments: [],
      categoryLabel,
      subcategoryLabel,
    });
  });

  if (skippedWithoutTitle > 0) warnings.push(`${skippedWithoutTitle} linha(s) sem título foram ignoradas.`);
  if (items.length === 0 && dataLines.length === 0) warnings.push("Nenhuma linha de dados encontrada na planilha.");

  return { items, warnings };
}
