import { parseCsvRows } from "@/lib/csv";
import type { ParsedImportItem, ParsedImportResult } from "../types";

export const SPREADSHEET_COLUMN_ROLES = ["ignore", "title", "category", "subcategory", "body"] as const;
export type SpreadsheetColumnRole = (typeof SPREADSHEET_COLUMN_ROLES)[number];

export const SPREADSHEET_DELIMITERS = [",", ";", "\t"] as const;
export type SpreadsheetDelimiter = (typeof SPREADSHEET_DELIMITERS)[number];

export interface SpreadsheetImportMapping {
  delimiter: SpreadsheetDelimiter;
  /** Um `SpreadsheetColumnRole` por índice de coluna, na ordem em que aparecem na primeira linha (cabeçalho). */
  columns: SpreadsheetColumnRole[];
}

/** Primeira linha do arquivo → nomes de coluna, pra tela de mapeamento mostrar algo melhor que "Coluna 1". */
export function readSpreadsheetHeaders(text: string, delimiter: SpreadsheetDelimiter): string[] {
  return parseCsvRows(text, delimiter)[0] ?? [];
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
  // Linha a linha quebrava uma célula com Enter (comum em "observações") em
  // duas linhas da planilha; o parser de CSV respeita as aspas.
  const rows = parseCsvRows(text, mapping.delimiter);
  if (rows.length === 0) return { items: [], warnings: ["A planilha está vazia."] };

  const headers = rows[0]!;
  const dataLines = rows.slice(1);

  const items: ParsedImportItem[] = [];
  const warnings: string[] = [];
  let skippedWithoutTitle = 0;

  dataLines.forEach((fields, index) => {
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
