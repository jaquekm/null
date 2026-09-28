/**
 * CSV sem dependência (RFC 4180 no essencial): campos entre aspas, aspas
 * escapadas (`""`), delimitador e quebra de linha dentro de aspas. Usado pelos
 * importadores de contatos e de planilha — antes cada um tinha o seu, e o de
 * planilha quebrava a linha no meio de uma célula com Enter.
 */
export function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const normalized = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export const CSV_DELIMITERS = [",", ";", "\t"] as const;
export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

/**
 * Excel em português salva CSV com `;` (a vírgula é o separador decimal);
 * Google/Outlook usam `,`. Escolhe o delimitador que mais aparece fora de
 * aspas na primeira linha não vazia (o cabeçalho).
 */
export function detectCsvDelimiter(text: string): CsvDelimiter {
  const firstLine = text.replace(/^﻿/, "").split(/\r\n|\r|\n/).find((line) => line.trim() !== "") ?? "";
  const counts: Record<CsvDelimiter, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char in counts) counts[char as CsvDelimiter] += 1;
  }
  return CSV_DELIMITERS.reduce((best, candidate) => (counts[candidate] > counts[best] ? candidate : best), ",");
}

/**
 * Texto de um arquivo enviado: UTF-8 se for válido, senão Windows-1252
 * (superset do ISO-8859-1). Planilhas salvas pelo Excel no Windows vêm
 * assim, e `file.text()` (sempre UTF-8) trocava todo acento por "�".
 */
export function decodeTextBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export async function readFileText(file: Blob): Promise<string> {
  return decodeTextBytes(new Uint8Array(await file.arrayBuffer()));
}
