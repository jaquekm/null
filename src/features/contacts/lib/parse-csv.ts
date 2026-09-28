import { detectCsvDelimiter, parseCsvRows } from "@/lib/csv";

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/**
 * CSV de contatos (3.3). O delimitador é detectado: Google/iPhone/Outlook
 * exportam com `,`, mas uma planilha salva pelo Excel em português usa `;`
 * — antes o arquivo inteiro virava uma coluna só.
 */
export function parseCsv(text: string): ParsedCsv {
  const [headers, ...rows] = parseCsvRows(text, detectCsvDelimiter(text));
  return { headers: headers ?? [], rows };
}
