import {
  CSV_DELIMITERS,
  splitCsvLine,
  type CsvColumnRole,
  type CsvDateFormat,
  type CsvDecimalSeparator,
  type CsvDelimiter,
  type CsvImportMapping,
} from "./parse-statement-csv";

const DATE_BR = /^\d{2}\/\d{2}\/\d{4}$/;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT_COMMA_DECIMAL = /^[-+(]?\s*(R\$\s*)?[\d.]*\d,\d{1,2}\)?$/i;
const AMOUNT_DOT_DECIMAL = /^[-+(]?\s*(R\$\s*)?[\d,]*\d\.\d{1,2}\)?$/i;
const SAMPLE_LINES = 40;

function isDate(field: string): boolean {
  const value = field.trim();
  return DATE_BR.test(value) || DATE_ISO.test(value);
}

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function roleFromHeader(header: string): CsvColumnRole | null {
  const name = normalizeHeader(header);
  if (!name) return null;
  if (name === "data" || name.startsWith("datado") || name === "date") return "date";
  if (["historico", "descricao", "lancamento", "lancamentos", "memo", "estabelecimento", "description", "detalhe", "detalhes"].some((k) => name.startsWith(k))) return "description";
  if (name.startsWith("credito") || name.startsWith("entrada") || name === "credit") return "credit";
  if (name.startsWith("debito") || name.startsWith("saida") || name === "debit") return "debit";
  if (name.startsWith("valor") || name.startsWith("montante") || name === "amount") return "amount";
  return null;
}

/** Separador que faz mais linhas terem uma data "pura" em algum campo — em `;`, `04/09/2026;TED...` quebra certo; em `,`, o mesmo texto vira um campo só e nunca bate. */
function detectDelimiter(lines: string[]): CsvDelimiter {
  let best: CsvDelimiter = ";";
  let bestScore = -1;
  for (const delimiter of CSV_DELIMITERS) {
    const score = lines.filter((line) => splitCsvLine(line, delimiter).some(isDate)).length;
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  if (bestScore > 0) return best;

  const widest = CSV_DELIMITERS.map((delimiter) => ({ delimiter, width: Math.max(0, ...lines.map((l) => splitCsvLine(l, delimiter).length)) }));
  return widest.sort((a, b) => b.width - a.width)[0]!.delimiter;
}

function detectDecimalSeparator(fields: string[]): CsvDecimalSeparator {
  let comma = 0;
  let dot = 0;
  for (const raw of fields) {
    const value = raw.trim();
    if (AMOUNT_COMMA_DECIMAL.test(value)) comma++;
    else if (AMOUNT_DOT_DECIMAL.test(value)) dot++;
  }
  return dot > comma ? "." : ",";
}

function looksLikeAmount(value: string): boolean {
  const v = value.trim();
  return v !== "" && (AMOUNT_COMMA_DECIMAL.test(v) || AMOUNT_DOT_DECIMAL.test(v) || /^-?\d+$/.test(v));
}

export interface DetectedCsvMapping extends CsvImportMapping {
  /** Nomes das colunas (linha logo antes da primeira linha de dados), vazio quando não há cabeçalho. */
  headers: string[];
}

/**
 * Adivinha o mapeamento de um CSV de extrato sem o dono configurar nada
 * (4.5+): separador, quantas linhas pular até a primeira linha com data,
 * formato da data, separador decimal e o papel de cada coluna pelo nome do
 * cabeçalho ("Histórico" → descrição, "Crédito (R$)" → crédito…). Pensado
 * pro formato real do Bradesco — uma linha "Extrato de: Ag…" antes do
 * cabeçalho, `;` como separador, crédito e débito em colunas separadas —
 * mas sem nada específico de banco: qualquer CSV com uma coluna de data
 * cai no mesmo caminho. A tela continua deixando o dono corrigir tudo.
 */
export function detectCsvMapping(text: string): DetectedCsvMapping | null {
  const lines = text
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim() !== "")
    .slice(0, SAMPLE_LINES);
  if (lines.length === 0) return null;

  const delimiter = detectDelimiter(lines);
  const rows = lines.map((line) => splitCsvLine(line, delimiter));

  const firstDataIndex = rows.findIndex((fields) => fields.some(isDate));
  if (firstDataIndex === -1) return null;

  const dataRows = rows.slice(firstDataIndex).filter((fields) => fields.some(isDate));
  const columnCount = Math.max(...dataRows.map((fields) => fields.length));
  const headers = firstDataIndex > 0 ? rows[firstDataIndex - 1]!.map((h) => h.trim()) : [];

  const dateColumn = rows[firstDataIndex]!.findIndex(isDate);
  const dateSample = rows[firstDataIndex]![dateColumn]!.trim();
  const dateFormat: CsvDateFormat = DATE_ISO.test(dateSample) ? "yyyy-MM-dd" : "dd/MM/yyyy";

  const columns: CsvColumnRole[] = Array.from({ length: columnCount }, (_, index) => {
    if (index === dateColumn) return "date";
    const fromHeader = roleFromHeader(headers[index] ?? "");
    return fromHeader === "date" ? "ignore" : (fromHeader ?? "ignore");
  });

  if (!columns.includes("description")) {
    const textColumn = columns.findIndex((role, index) => role === "ignore" && dataRows.some((fields) => /[a-zA-Z]{3,}/.test(fields[index] ?? "")));
    if (textColumn !== -1) columns[textColumn] = "description";
  }

  if (!columns.includes("amount") && !columns.includes("credit") && !columns.includes("debit")) {
    const amountColumns = columns
      .map((role, index) => ({ role, index }))
      .filter(({ role, index }) => role === "ignore" && dataRows.every((fields) => (fields[index] ?? "").trim() === "" || looksLikeAmount(fields[index] ?? "")) && dataRows.some((fields) => looksLikeAmount(fields[index] ?? "")));
    if (amountColumns.length >= 1) columns[amountColumns[0]!.index] = "amount";
  }

  const amountFields = dataRows.flatMap((fields) => fields.filter((_, index) => columns[index] === "amount" || columns[index] === "credit" || columns[index] === "debit"));
  const decimalSeparator = detectDecimalSeparator(amountFields);

  return { delimiter, decimalSeparator, dateFormat, headerRowsToSkip: firstDataIndex, columns, headers };
}

/** O mapeamento salvo da última importação desta conta só vale se ainda bater com o arquivo novo — senão (outro banco, outro layout) um mapeamento velho travaria a tela com colunas erradas. */
export function isMappingUsable(mapping: CsvImportMapping, detected: DetectedCsvMapping): boolean {
  return (
    mapping.delimiter === detected.delimiter &&
    mapping.headerRowsToSkip === detected.headerRowsToSkip &&
    mapping.columns.length === detected.columns.length &&
    mapping.columns.includes("date") &&
    mapping.columns.includes("description") &&
    (mapping.columns.includes("amount") || mapping.columns.includes("debit") || mapping.columns.includes("credit"))
  );
}
