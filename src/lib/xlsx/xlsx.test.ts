import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { readXlsxRows, serialToIso } from "./read";
import { buildXlsx, columnLetter, excelSerial, sheetName } from "./write";

describe("columnLetter / excelSerial / sheetName", () => {
  it("colunas A…Z, AA…", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnLetter)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });

  it("série do Excel ida e volta", () => {
    expect(excelSerial("1900-03-01")).toBe(61);
    expect(excelSerial("2026-09-29")).toBe(46294);
    expect(excelSerial("2026-09-29T18:00")).toBe(46294.75);
    expect(serialToIso(46294)).toBe("2026-09-29");
    expect(serialToIso(46294.75)).toBe("2026-09-29T18:00");
  });

  it("nome de aba válido", () => {
    expect(sheetName("Compras: setembro/outubro [casa]")).toBe("Compras  setembro outubro  casa");
    expect(sheetName("   ")).toBe("Planilha");
  });
});

describe("buildXlsx → readXlsxRows", () => {
  it("ida e volta com texto, número, dinheiro, porcentagem, data e booleano", async () => {
    const bytes = await buildXlsx({
      name: "Compras",
      header: ["Item", "Qtd", "Preço", "Desconto", "Data", "Pago"],
      rows: [
        ["Arroz & feijão <5kg>", 2, { money: 25.9 }, { percent: 0.1 }, { date: "2026-09-29" }, true],
        ["Café", 1, { money: 18 }, null, { date: "2026-10-01T09:30" }, false],
        [null, null, null, null, null, null],
      ],
    });
    const rows = await readXlsxRows(bytes);
    expect(rows).toEqual([
      ["Item", "Qtd", "Preço", "Desconto", "Data", "Pago"],
      ["Arroz & feijão <5kg>", 2, 25.9, 0.1, "2026-09-29", true],
      ["Café", 1, 18, null, "2026-10-01T09:30", false],
    ]);
  });

  it("o zip tem as partes que o Excel exige", async () => {
    const zip = await JSZip.loadAsync(await buildXlsx({ name: "A", header: ["x"], rows: [] }));
    expect(Object.keys(zip.files).sort()).toEqual(
      ["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"].sort(),
    );
  });
});

describe("readXlsxRows — arquivo como o Excel salva", () => {
  it("strings compartilhadas, texto rico, célula pulada e data com formato próprio", async () => {
    const zip = new JSZip();
    zip.file("xl/workbook.xml", `<workbook><sheets><sheet name="Plan1" sheetId="1" r:id="rId3"/></sheets></workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", `<Relationships><Relationship Id="rId3" Type="x" Target="worksheets/sheet7.xml"/></Relationships>`);
    zip.file("xl/sharedStrings.xml", `<sst><si><t>Nome</t></si><si><t>Vencimento</t></si><si><r><t>Conta de </t></r><r><rPr><b/></rPr><t>luz</t></r></si></sst>`);
    zip.file(
      "xl/styles.xml",
      `<styleSheet><numFmts count="1"><numFmt numFmtId="180" formatCode="dd/mm/yy;@"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="180" applyNumberFormat="1"/></cellXfs></styleSheet>`,
    );
    zip.file(
      "xl/worksheets/sheet7.xml",
      `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3"><v>142.5</v></c><c r="C3" s="1"><v>46294</v></c></row><row r="4"/></sheetData></worksheet>`,
    );
    const rows = await readXlsxRows(await zip.generateAsync({ type: "uint8array" }));
    expect(rows).toEqual([["Nome", null, "Vencimento"], [], ["Conta de luz", 142.5, "2026-09-29"]]);
  });

  it("arquivo que não é xlsx dá erro claro", async () => {
    const zip = new JSZip();
    zip.file("oi.txt", "x");
    await expect(readXlsxRows(await zip.generateAsync({ type: "uint8array" }))).rejects.toThrow("Arquivo não parece ser uma planilha do Excel (.xlsx).");
  });
});
