import JSZip from "jszip";

/**
 * Planilha .xlsx mínima (9.6, "exportar pra Excel"): uma aba, cabeçalho em
 * negrito e congelado, filtro no cabeçalho, datas/dinheiro/porcentagem com
 * formato brasileiro. Um .xlsx é um zip de XMLs (Office Open XML) — o JSZip
 * que o projeto já usa na importação basta, sem biblioteca de planilha.
 */
export type XlsxCell =
  | string
  | number
  | boolean
  | null
  | undefined
  | { date: string } // yyyy-MM-dd ou yyyy-MM-ddTHH:mm
  | { money: number } // em reais
  | { percent: number }; // fração (0,15 = 15%)

export interface XlsxSheet {
  name: string;
  header: string[];
  rows: XlsxCell[][];
}

const STYLE = { header: 1, date: 2, dateTime: 3, money: 4, percent: 5 } as const;

// Tira caracteres que o XML não aceita (controle) e escapa os especiais.
function xmlText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Data (yyyy-MM-dd[THH:mm]) → número de série do Excel (dias desde 30/12/1899). */
export function excelSerial(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const days = (Date.UTC(Number(y), Number(m) - 1, Number(d)) - Date.UTC(1899, 11, 30)) / 86_400_000;
  const fraction = hh ? (Number(hh) * 60 + Number(mm)) / 1440 : 0;
  return days + fraction;
}

function cellXml(ref: string, cell: XlsxCell): string {
  if (cell === null || cell === undefined || cell === "") return "";
  if (typeof cell === "number") return Number.isFinite(cell) ? `<c r="${ref}"><v>${cell}</v></c>` : "";
  if (typeof cell === "boolean") return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`;
  if (typeof cell === "string") return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlText(cell)}</t></is></c>`;
  if ("date" in cell) {
    const serial = excelSerial(cell.date);
    if (serial === null) return cellXml(ref, cell.date);
    return `<c r="${ref}" s="${cell.date.includes("T") ? STYLE.dateTime : STYLE.date}"><v>${serial}</v></c>`;
  }
  if ("money" in cell) return Number.isFinite(cell.money) ? `<c r="${ref}" s="${STYLE.money}"><v>${cell.money}</v></c>` : "";
  return Number.isFinite(cell.percent) ? `<c r="${ref}" s="${STYLE.percent}"><v>${cell.percent}</v></c>` : "";
}

function sheetXml(sheet: XlsxSheet): string {
  const width = Math.max(sheet.header.length, ...sheet.rows.map((row) => row.length), 1);
  const lastCol = columnLetter(width - 1);
  const headerRow = `<row r="1">${sheet.header
    .map((label, i) => `<c r="${columnLetter(i)}1" t="inlineStr" s="${STYLE.header}"><is><t xml:space="preserve">${xmlText(label)}</t></is></c>`)
    .join("")}</row>`;
  const body = sheet.rows
    .map((row, r) => `<row r="${r + 2}">${row.map((cell, c) => cellXml(`${columnLetter(c)}${r + 2}`, cell)).join("")}</row>`)
    .join("");
  const cols = sheet.header
    .map((label, i) => {
      const longest = Math.max(label.length, ...sheet.rows.slice(0, 200).map((row) => displayLength(row[i])));
      return `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(10, longest + 2))}" customWidth="1"/>`;
    })
    .join("");
  const lastRow = sheet.rows.length + 1;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${headerRow}${body}</sheetData>` +
    (sheet.header.length > 0 ? `<autoFilter ref="A1:${lastCol}${lastRow}"/>` : "") +
    `</worksheet>`
  );
}

function displayLength(cell: XlsxCell): number {
  if (cell === null || cell === undefined) return 0;
  if (typeof cell === "string") return cell.length;
  if (typeof cell === "number" || typeof cell === "boolean") return String(cell).length;
  if ("date" in cell) return cell.date.includes("T") ? 16 : 10;
  return 12;
}

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="166" formatCode="&quot;R$&quot; #,##0.00"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="6">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs></styleSheet>`;

/** Nome de aba válido no Excel: até 31 caracteres, sem : \ / ? * [ ]. */
export function sheetName(name: string): string {
  const clean = name.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31);
  return clean || "Planilha";
}

export async function buildXlsx(sheet: XlsxSheet): Promise<Uint8Array> {
  const zip = new JSZip();
  // Sem entradas de pasta no zip (o Excel não gera e alguns leitores estranham).
  const add = (path: string, content: string) => zip.file(path, content, { createFolders: false });
  add(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  );
  add(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  add(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlText(sheetName(sheet.name))}" sheetId="1" r:id="rId1"/></sheets>${
      sheet.header.length > 0
        ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xmlText(sheetName(sheet.name)).replace(/'/g, "''")}'!$A$1:$${columnLetter(sheet.header.length - 1)}$${sheet.rows.length + 1}</definedName></definedNames>`
        : ""
    }</workbook>`,
  );
  add(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  add("xl/styles.xml", STYLES_XML);
  add("xl/worksheets/sheet1.xml", sheetXml(sheet));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
