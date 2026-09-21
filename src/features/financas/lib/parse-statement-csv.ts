import type { ParsedStatementRow } from "./statement-row";

export const CSV_COLUMN_ROLES = ["ignore", "date", "description", "amount", "debit", "credit"] as const;
export type CsvColumnRole = (typeof CSV_COLUMN_ROLES)[number];

export const CSV_DELIMITERS = [",", ";"] as const;
export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

export const CSV_DECIMAL_SEPARATORS = [",", "."] as const;
export type CsvDecimalSeparator = (typeof CSV_DECIMAL_SEPARATORS)[number];

export const CSV_DATE_FORMATS = ["dd/MM/yyyy", "yyyy-MM-dd"] as const;
export type CsvDateFormat = (typeof CSV_DATE_FORMATS)[number];

export interface CsvImportMapping {
  delimiter: CsvDelimiter;
  decimalSeparator: CsvDecimalSeparator;
  dateFormat: CsvDateFormat;
  headerRowsToSkip: number;
  /** Um `CsvColumnRole` por índice de coluna, na ordem em que aparecem no arquivo. */
  columns: CsvColumnRole[];
}

/** RFC 4180 essencial (campos entre aspas, aspas escapadas `""`), com delimitador configurável — `,` ou `;` (4.5). Exportada pra UI montar a prévia de colunas na tela de mapeamento. */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
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

    if (char === '"') inQuotes = true;
    else if (char === delimiter) {
      fields.push(field);
      field = "";
    } else field += char;
  }
  fields.push(field);
  return fields;
}

function parseCsvDate(raw: string, format: CsvDateFormat): string | null {
  const trimmed = raw.trim();
  if (format === "yyyy-MM-dd") {
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
  }
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

/** Sabendo o separador decimal com certeza (configurado, não adivinhado), converte pra centavos sem a heurística ambígua do `parseBRL` (4.1). */
function parseCsvAmount(raw: string, decimalSeparator: CsvDecimalSeparator): number | null {
  let s = raw.trim().replace(/R\$\s*/gi, "");
  if (s === "") return null;

  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1);
  }

  const thousandsChar = decimalSeparator === "," ? "." : ",";
  s = s.split(thousandsChar).join("");
  s = s.replace(decimalSeparator, ".");

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return negative ? -cents : cents;
}

/**
 * CSV de extrato bancário (4.5) — diferente do `parseCsv` de contatos (3.3):
 * delimitador configurável (`;`/`,`), formato de data e separador decimal
 * escolhidos pelo dono (não adivinhados), e cada coluna mapeada por posição
 * pra um papel (`data`/`descrição`/`valor` OU `débito`+`crédito` separados).
 * Débito/crédito: crédito > 0 vira entrada positiva, senão débito vira saída
 * negativa (só um dos dois costuma vir preenchido por linha).
 */
export function parseStatementCsv(content: string, mapping: CsvImportMapping): ParsedStatementRow[] {
  const allLines = content.split(/\r\n|\r|\n/).filter((line) => line.trim() !== "");
  const dataLines = allLines.slice(mapping.headerRowsToSkip);

  return dataLines.map((line) => {
    const fields = splitCsvLine(line, mapping.delimiter);

    let occurredOn: string | null = null;
    let description = "";
    let amountCents: number | null = null;
    let debitCents: number | null = null;
    let creditCents: number | null = null;

    mapping.columns.forEach((role, index) => {
      const raw = (fields[index] ?? "").trim();
      if (role === "date") occurredOn = parseCsvDate(raw, mapping.dateFormat);
      else if (role === "description") description = [description, raw].filter(Boolean).join(" ");
      else if (role === "amount") amountCents = raw ? parseCsvAmount(raw, mapping.decimalSeparator) : null;
      else if (role === "debit") debitCents = raw ? parseCsvAmount(raw, mapping.decimalSeparator) : null;
      else if (role === "credit") creditCents = raw ? parseCsvAmount(raw, mapping.decimalSeparator) : null;
    });

    if (amountCents === null && (debitCents !== null || creditCents !== null)) {
      const creditAbs = creditCents !== null ? Math.abs(creditCents) : 0;
      const debitAbs = debitCents !== null ? Math.abs(debitCents) : 0;
      if (creditAbs > 0) amountCents = creditAbs;
      else if (debitAbs > 0) amountCents = -debitAbs;
    }

    const errors: string[] = [];
    if (!occurredOn) errors.push("data inválida");
    if (amountCents === null) errors.push("valor inválido");
    if (!description) errors.push("sem descrição");

    return { fitid: null, occurredOn, amountCents, description, error: errors.length > 0 ? errors.join(", ") : null };
  });
}
