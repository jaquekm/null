import { normalizeName } from "@/features/types/lib/formula";
import type { FieldDefinition } from "@/features/types/schemas";
import { decodeTextBytes, detectCsvDelimiter, parseCsvRows } from "@/lib/csv";
import { readXlsxRows, type XlsxValue } from "@/lib/xlsx/read";

/**
 * "Importar planilha" na Tabela (9.6): cada linha vira um item do tipo da
 * visão. Colunas casam com os campos pelo nome (sem acento/maiúsculas) ou
 * pela chave; a coluna "Título"/"Nome" (ou a primeira que sobrar com texto)
 * vira o título. Cada valor é lido conforme o tipo do campo — "R$ 1.234,56",
 * "29/09/2026", "sim"… — e o que não dá pra ler fica de fora com aviso.
 */
export type ColumnTarget = { kind: "title" } | { kind: "field"; key: string } | { kind: "ignore" };

export interface ImportColumn {
  header: string;
  target: ColumnTarget;
}

export interface ImportRow {
  title: string;
  properties: Record<string, unknown>;
}

export interface SheetImportPlan {
  columns: ImportColumn[];
  rows: ImportRow[];
  /** Linhas sem título (puladas). */
  skipped: number;
  /** Valores que não deu pra ler, por coluna. */
  problems: { header: string; count: number; example: string }[];
}

const TITLE_HEADERS = new Set(["titulo", "nome", "item", "descricao", "title", "name", "tarefa", "produto"]);
const IMPORTABLE: FieldDefinition["type"][] = ["text", "long_text", "number", "money", "percent", "date", "datetime", "select", "multi_select", "checkbox", "url", "email", "phone", "rating", "duration"];
export const MAX_IMPORT_ROWS = 2000;

export function planColumns(headers: XlsxValue[], fields: FieldDefinition[]): ImportColumn[] {
  const byName = new Map<string, FieldDefinition>();
  for (const field of fields) {
    if (!IMPORTABLE.includes(field.type) || field.hidden) continue;
    byName.set(normalizeName(field.key), field);
    byName.set(normalizeName(field.label), field);
  }
  const used = new Set<string>();
  let titleTaken = false;
  const columns = headers.map((raw): ImportColumn => {
    const header = String(raw ?? "").trim();
    const name = normalizeName(header);
    if (!titleTaken && TITLE_HEADERS.has(name)) {
      titleTaken = true;
      return { header, target: { kind: "title" } };
    }
    const field = byName.get(name);
    if (field && !used.has(field.key)) {
      used.add(field.key);
      return { header, target: { kind: "field", key: field.key } };
    }
    return { header, target: { kind: "ignore" } };
  });
  // Sem coluna "Título": a primeira coluna que não virou campo.
  if (!titleTaken) {
    const first = columns.find((column) => column.target.kind === "ignore" && column.header);
    if (first) first.target = { kind: "title" };
  }
  return columns;
}

/** "1.234,56", "1234.56", "R$ 10", 12 → número (em reais, no caso de dinheiro). */
export function parseNumber(raw: XlsxValue): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  let text = raw.replace(/R\$|\s|%/g, "").replace(/[^\d,.-]/g, "");
  if (!text || !/\d/.test(text)) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) text = text.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma && lastComma >= 0) text = text.replace(/,/g, "");
  else if (lastDot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function parseDate(raw: XlsxValue): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/.exec(text);
  let y: number;
  let m: number;
  let d: number;
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (br) [d, m, y] = [Number(br[1]), Number(br[2]), br[3]!.length === 2 ? 2000 + Number(br[3]) : Number(br[3])];
  else return null;
  if (m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseTime(raw: string): string | null {
  const match = /(?:T|\s)(\d{1,2}):(\d{2})/.exec(raw);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

function optionId(field: FieldDefinition, raw: string): string | null {
  const wanted = normalizeName(raw);
  const option = field.options?.find((o) => normalizeName(o.label) === wanted || o.id === raw);
  return option?.id ?? null;
}

/** Valor da célula no formato de `items.properties`; `undefined` = vazio; `null` = não deu pra ler. */
export function parseCell(field: FieldDefinition, raw: XlsxValue): unknown {
  if (raw === null || raw === "" || (typeof raw === "string" && raw.trim() === "")) return undefined;
  switch (field.type) {
    case "text":
    case "long_text":
    case "phone":
      return String(raw).trim();
    case "url":
    case "email":
      return String(raw).trim();
    case "number":
    case "duration":
      return parseNumber(raw);
    case "rating": {
      const value = parseNumber(raw);
      return value === null ? null : Math.round(value);
    }
    case "money": {
      const value = parseNumber(raw);
      return value === null ? null : Math.round(value * 100);
    }
    case "percent": {
      if (typeof raw === "number") return Math.round((Math.abs(raw) <= 1 ? raw * 100 : raw) * 100) / 100; // Excel guarda 15% como 0,15
      return parseNumber(raw);
    }
    case "date":
      return parseDate(String(raw));
    case "datetime": {
      const date = parseDate(String(raw));
      if (!date) return null;
      return `${date}T${parseTime(String(raw)) ?? "00:00"}`;
    }
    case "checkbox": {
      if (typeof raw === "boolean") return raw;
      const text = normalizeName(String(raw));
      if (["sim", "s", "x", "true", "verdadeiro", "1", "ok", "feito", "yes"].includes(text)) return true;
      if (["nao", "n", "false", "falso", "0", "no"].includes(text)) return false;
      return null;
    }
    case "select":
      return optionId(field, String(raw).trim());
    case "multi_select": {
      const ids = String(raw)
        .split(/[,;]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => optionId(field, part));
      return ids.some((id) => id === null) ? null : ids;
    }
    default:
      return undefined;
  }
}

export function planSheetImport(sheetRows: XlsxValue[][], fields: FieldDefinition[]): SheetImportPlan {
  const [headers = [], ...data] = sheetRows;
  const columns = planColumns(headers, fields);
  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  const problems = new Map<string, { count: number; example: string }>();
  const rows: ImportRow[] = [];
  let skipped = 0;

  for (const cells of data) {
    if (cells.every((cell) => cell === null || cell === "")) continue;
    let title = "";
    const properties: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      const raw = cells[index] ?? null;
      if (column.target.kind === "title") {
        title = raw === null ? "" : String(raw).trim();
        return;
      }
      if (column.target.kind !== "field") return;
      const field = fieldByKey.get(column.target.key)!;
      const value = parseCell(field, raw);
      if (value === undefined) return;
      if (value === null) {
        const current = problems.get(column.header) ?? { count: 0, example: String(raw) };
        problems.set(column.header, { ...current, count: current.count + 1 });
        return;
      }
      properties[field.key] = value;
    });
    if (!title) {
      skipped += 1;
      continue;
    }
    rows.push({ title: title.slice(0, 500), properties });
  }

  return {
    columns,
    rows: rows.slice(0, MAX_IMPORT_ROWS),
    skipped,
    problems: [...problems].map(([header, info]) => ({ header, ...info })),
  };
}

/** Arquivo escolhido → linhas: `.xlsx` pelo leitor de Excel; `.csv`/`.tsv`/`.txt` com acento do Windows e separador detectado (";" do Excel em português). */
export async function readSheetRows(fileName: string, bytes: Uint8Array): Promise<XlsxValue[][]> {
  const name = fileName.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) return readXlsxRows(bytes);
  if (name.endsWith(".xls") || name.endsWith(".ods") || name.endsWith(".numbers")) {
    throw new Error("Esse formato não dá pra ler. No Excel (ou no app de planilha), use “Salvar como” .xlsx ou .csv.");
  }
  const text = decodeTextBytes(bytes);
  return parseCsvRows(text, name.endsWith(".tsv") ? "\t" : detectCsvDelimiter(text));
}
