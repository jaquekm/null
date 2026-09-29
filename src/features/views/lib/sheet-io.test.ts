import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "@/features/types/schemas";
import { buildExportSheet, exportableFields } from "./sheet-export";
import { buildXlsx } from "@/lib/xlsx/write";
import { parseCell, parseNumber, planColumns, planSheetImport, readSheetRows } from "./sheet-import";

const f = (patch: Partial<FieldDefinition> & Pick<FieldDefinition, "key" | "label" | "type">): FieldDefinition => ({ required: false, ...patch });

const FIELDS = [
  f({ key: "quantidade", label: "Quantidade", type: "number" }),
  f({ key: "preco", label: "Preço", type: "money" }),
  f({ key: "desconto", label: "Desconto", type: "percent" }),
  f({ key: "vence", label: "Vencimento", type: "date" }),
  f({ key: "pago", label: "Pago", type: "checkbox" }),
  f({ key: "categoria", label: "Categoria", type: "select", options: [{ id: "c1", label: "Mercado" }, { id: "c2", label: "Farmácia" }] }),
  f({ key: "tags", label: "Etiquetas", type: "multi_select", options: [{ id: "t1", label: "Casa" }, { id: "t2", label: "Urgente" }] }),
  f({ key: "total", label: "Total", type: "formula", formula: "quantidade * preco", formulaFormat: "money" }),
  f({ key: "responsavel", label: "Responsável", type: "contact" }),
  f({ key: "quando", label: "Quando", type: "datetime" }),
];

describe("parseNumber", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["R$ 1.234,56", 1234.56],
    ["1234.56", 1234.56],
    ["1,234.56", 1234.56],
    ["1.234", 1234],
    ["12,5%", 12.5],
    ["-3", -3],
    ["abc", null],
  ])("%s → %s", (raw, expected) => {
    expect(parseNumber(raw)).toBe(expected);
  });
});

describe("parseCell", () => {
  const field = (key: string) => FIELDS.find((x) => x.key === key)!;
  it("dinheiro vira centavos", () => {
    expect(parseCell(field("preco"), "R$ 10,50")).toBe(1050);
    expect(parseCell(field("preco"), 25.9)).toBe(2590);
  });
  it("porcentagem do Excel (fração) e escrita", () => {
    expect(parseCell(field("desconto"), 0.15)).toBe(15);
    expect(parseCell(field("desconto"), "15%")).toBe(15);
    expect(parseCell(field("desconto"), 20)).toBe(20);
  });
  it("datas", () => {
    expect(parseCell(field("vence"), "2026-09-29")).toBe("2026-09-29");
    expect(parseCell(field("vence"), "29/09/2026")).toBe("2026-09-29");
    expect(parseCell(field("vence"), "5/1/27")).toBe("2027-01-05");
    expect(parseCell(field("vence"), "31/02/2026")).toBeNull();
    expect(parseCell(field("quando"), "29/09/2026 14:30")).toBe("2026-09-29T14:30");
  });
  it("sim/não, seleção por nome", () => {
    expect(parseCell(field("pago"), "Sim")).toBe(true);
    expect(parseCell(field("pago"), "não")).toBe(false);
    expect(parseCell(field("pago"), "talvez")).toBeNull();
    expect(parseCell(field("categoria"), "farmacia")).toBe("c2");
    expect(parseCell(field("categoria"), "Padaria")).toBeNull();
    expect(parseCell(field("tags"), "Casa; Urgente")).toEqual(["t1", "t2"]);
  });
  it("vazio → undefined", () => {
    expect(parseCell(field("preco"), "  ")).toBeUndefined();
    expect(parseCell(field("preco"), null)).toBeUndefined();
  });
});

describe("planColumns / planSheetImport", () => {
  it("casa colunas pelo nome, acha o título e ignora o resto", () => {
    const columns = planColumns(["Nome", "preco", "QUANTIDADE", "Total", "Responsável", "Obs"], FIELDS);
    expect(columns.map((c) => c.target)).toEqual([
      { kind: "title" },
      { kind: "field", key: "preco" },
      { kind: "field", key: "quantidade" },
      { kind: "ignore" }, // fórmula é calculada, não importada
      { kind: "ignore" }, // contato é id de outro registro
      { kind: "ignore" },
    ]);
  });

  it("sem coluna de título, a primeira que sobrar vira título", () => {
    expect(planColumns(["Produto X", "Preço"], FIELDS)[0]!.target).toEqual({ kind: "title" });
  });

  it("monta os itens, pula linha sem título e conta o que não leu", () => {
    const plan = planSheetImport(
      [
        ["Item", "Quantidade", "Preço", "Pago", "Categoria"],
        ["Arroz", 2, "R$ 25,90", "sim", "Mercado"],
        ["", 1, 3, null, null],
        ["Remédio", "um", 18, "x", "Padaria"],
        [null, null, null, null, null],
      ],
      FIELDS,
    );
    expect(plan.rows).toEqual([
      { title: "Arroz", properties: { quantidade: 2, preco: 2590, pago: true, categoria: "c1" } },
      { title: "Remédio", properties: { preco: 1800, pago: true } },
    ]);
    expect(plan.skipped).toBe(1);
    expect(plan.problems).toEqual([
      { header: "Quantidade", count: 1, example: "um" },
      { header: "Categoria", count: 1, example: "Padaria" },
    ]);
  });
});

describe("buildExportSheet", () => {
  it("título + colunas no formato certo; contato fica de fora", () => {
    const fields = exportableFields(FIELDS);
    expect(fields.map((x) => x.key)).not.toContain("responsavel");
    const sheet = buildExportSheet(
      "Compras",
      [{ title: "Arroz", properties: { quantidade: 2, preco: 2590, desconto: 10, vence: "2026-09-29", pago: true, categoria: "c1", tags: ["t1", "t2"], total: 5180, quando: "2026-09-29T17:30:00.000Z" } }],
      fields,
      "America/Sao_Paulo",
    );
    expect(sheet.header).toEqual(["Título", "Quantidade", "Preço", "Desconto", "Vencimento", "Pago", "Categoria", "Etiquetas", "Total", "Quando"]);
    expect(sheet.rows[0]).toEqual(["Arroz", 2, { money: 25.9 }, { percent: 0.1 }, { date: "2026-09-29" }, "Sim", "Mercado", "Casa, Urgente", { money: 51.8 }, { date: "2026-09-29T14:30" }]);
  });

  it("respeita as colunas visíveis", () => {
    expect(exportableFields(FIELDS, ["preco"]).map((x) => x.key)).toEqual(["preco"]);
  });
});

describe("readSheetRows", () => {
  it("CSV do Excel em português (;) com acento do Windows", async () => {
    const bytes = new Uint8Array([...new TextEncoder().encode("Nome;Pre"), 0xe7, 0x6f, ...new TextEncoder().encode("\nCaf"), 0xe9, ...new TextEncoder().encode(";10,50\n")]);
    expect(await readSheetRows("compras.csv", bytes)).toEqual([["Nome", "Preço"], ["Café", "10,50"]]);
  });

  it("xlsx", async () => {
    const bytes = await buildXlsx({ name: "A", header: ["Nome", "Preço"], rows: [["Café", { money: 10.5 }]] });
    expect(await readSheetRows("compras.xlsx", bytes)).toEqual([["Nome", "Preço"], ["Café", 10.5]]);
  });

  it(".xls antigo pede pra salvar como .xlsx", async () => {
    await expect(readSheetRows("velho.xls", new Uint8Array())).rejects.toThrow("Salvar como");
  });
});
