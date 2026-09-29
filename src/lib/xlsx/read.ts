import JSZip from "jszip";
import { columnLetter } from "./write";

/**
 * Lê a primeira aba de um .xlsx (9.6, "importar do Excel") como linhas de
 * valores. Datas (células numéricas com formato de data) viram texto
 * `yyyy-MM-dd` (ou `yyyy-MM-ddTHH:mm`), pra quem mapeia não precisar saber
 * de número de série. Parser de XML por expressão regular, restrito às
 * poucas formas que o SpreadsheetML usa — roda igual no navegador e no Node.
 */
export type XlsxValue = string | number | boolean | null;

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&");
}

/** Todo texto dentro de <t>…</t> (texto rico vem em vários pedaços). */
function textOf(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1]!)).join("");
}

function attr(tag: string, name: string): string | null {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let index = 0;
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

function isDateFormat(code: string): boolean {
  // Tira texto entre aspas e cores/condições antes de procurar d/m/y/h.
  const bare = code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "");
  return /[dy]/i.test(bare) || /m{3,}/i.test(bare);
}

/** Série do Excel → yyyy-MM-dd (e HH:mm se tiver hora). */
export function serialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86_400_000);
  const date = new Date(ms);
  const iso = date.toISOString();
  const hasTime = Math.abs(serial - Math.floor(serial)) > 1e-9;
  return hasTime ? iso.slice(0, 16) : iso.slice(0, 10);
}

export async function readXlsxRows(data: ArrayBuffer | Uint8Array): Promise<XlsxValue[][]> {
  const zip = await JSZip.loadAsync(data);
  const read = async (path: string) => (await zip.file(path)?.async("text")) ?? null;

  const workbook = await read("xl/workbook.xml");
  if (!workbook) throw new Error("Arquivo não parece ser uma planilha do Excel (.xlsx).");
  const firstSheet = /<sheet\s[^>]*>/.exec(workbook)?.[0];
  const relId = firstSheet ? (attr(firstSheet, "r:id") ?? attr(firstSheet, "id")) : null;
  const rels = (await read("xl/_rels/workbook.xml.rels")) ?? "";
  let target = "worksheets/sheet1.xml";
  for (const rel of rels.match(/<Relationship\s[^>]*>/g) ?? []) {
    if (attr(rel, "Id") === relId) target = attr(rel, "Target") ?? target;
  }
  const sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  const sheet = await read(sheetPath);
  if (!sheet) throw new Error("Não achei a primeira aba da planilha.");

  const shared = [...((await read("xl/sharedStrings.xml")) ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]!));

  // Quais estilos (índice em cellXfs) são de data.
  const styles = (await read("xl/styles.xml")) ?? "";
  const customFormats = new Map([...styles.matchAll(/<numFmt\s[^>]*>/g)].map((m) => [Number(attr(m[0], "numFmtId")), decodeXml(attr(m[0], "formatCode") ?? "")]));
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? "";
  const dateStyles = new Set<number>();
  [...cellXfs.matchAll(/<xf\s[^>]*?\/?>/g)].forEach((m, index) => {
    const id = Number(attr(m[0], "numFmtId") ?? 0);
    if (BUILTIN_DATE_FORMATS.has(id) || (customFormats.has(id) && isDateFormat(customFormats.get(id)!))) dateStyles.add(index);
  });

  const rows: XlsxValue[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const rowAttrs = rowMatch[1] ?? rowMatch[3] ?? "";
    const rowIndex = Number(attr(` ${rowAttrs}`, "r") ?? rows.length + 1) - 1;
    const row: XlsxValue[] = [];
    for (const cell of (rowMatch[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = ` ${cell[1]}`;
      const inner = cell[2] ?? "";
      const ref = attr(tag, "r");
      const col = ref ? columnIndex(ref) : row.length;
      const type = attr(tag, "t");
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value: XlsxValue = null;
      if (type === "s") value = raw !== undefined ? (shared[Number(raw)] ?? null) : null;
      else if (type === "inlineStr") value = textOf(inner);
      else if (type === "str") value = raw !== undefined ? decodeXml(raw) : null;
      else if (type === "b") value = raw === "1";
      else if (type === "e") value = null;
      else if (raw !== undefined && raw !== "") {
        const number = Number(raw);
        const style = Number(attr(tag, "s") ?? -1);
        value = Number.isFinite(number) ? (dateStyles.has(style) ? serialToIso(number) : number) : decodeXml(raw);
      }
      row[col] = value;
    }
    for (let i = 0; i < row.length; i += 1) if (row[i] === undefined) row[i] = null;
    rows[rowIndex] = row;
  }
  // Linhas que faltaram no meio viram vazias; as vazias no fim somem.
  const dense = Array.from(rows, (row) => row ?? []);
  while (dense.length > 0 && dense.at(-1)!.every((v) => v === null || v === "")) dense.pop();
  return dense;
}

export { columnLetter };
