export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/**
 * Parser de CSV (3.3, "importação... com mapeamento de colunas") — sem
 * dependência nova: cobre o essencial do RFC 4180 (campos entre aspas,
 * aspas escapadas como `""`, vírgula/quebra de linha dentro de aspas).
 * Delimitador fixo em vírgula — é o padrão de toda exportação de contatos
 * (Google/iPhone/Outlook), e o próprio enunciado não pede escolher outro.
 */
export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

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
    } else if (char === ",") {
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
  // última linha sem quebra final
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  const [headers, ...dataRows] = nonEmptyRows;
  return { headers: headers ?? [], rows: dataRows };
}
