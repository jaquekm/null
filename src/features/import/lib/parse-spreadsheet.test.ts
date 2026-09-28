import { describe, expect, it } from "vitest";
import { parseSpreadsheetCsv, readSpreadsheetHeaders, type SpreadsheetColumnRole } from "./parse-spreadsheet";

const mapping = (columns: SpreadsheetColumnRole[]) => ({ delimiter: "," as const, columns });

describe("readSpreadsheetHeaders", () => {
  it("lê a primeira linha como cabeçalho", () => {
    expect(readSpreadsheetHeaders("Item,Categoria,Subcategoria\nCaixas,Embalagem,Fita", ",")).toEqual(["Item", "Categoria", "Subcategoria"]);
  });

  it("respeita o delimitador", () => {
    expect(readSpreadsheetHeaders("Item;Categoria", ";")).toEqual(["Item", "Categoria"]);
  });

  it("arquivo vazio devolve lista vazia", () => {
    expect(readSpreadsheetHeaders("", ",")).toEqual([]);
  });
});

describe("parseSpreadsheetCsv", () => {
  it("mapeia título, categoria e subcategoria por coluna", () => {
    const text = ["Item,Categoria,Subcategoria", "Caixas de papelão,Embalagem,Materiais", "Fita adesiva,Embalagem,Materiais"].join("\n");
    const result = parseSpreadsheetCsv(text, mapping(["title", "category", "subcategory"]));

    expect(result.warnings).toEqual([]);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ title: "Caixas de papelão", categoryLabel: "Embalagem", subcategoryLabel: "Materiais" });
    expect(result.items[1]).toMatchObject({ title: "Fita adesiva", categoryLabel: "Embalagem", subcategoryLabel: "Materiais" });
  });

  it("colunas 'body' viram linhas no corpo, rotuladas com o nome do cabeçalho", () => {
    const text = ["Item,Responsável,Prazo", "Contratar transportadora,João,10/10"].join("\n");
    const result = parseSpreadsheetCsv(text, mapping(["title", "body", "body"]));

    expect(result.items[0]!.bodyMarkdown).toBe("Responsável: João\nPrazo: 10/10");
  });

  it("colunas 'ignore' não aparecem em nada", () => {
    const text = ["Item,Lixo", "Fazer as malas,não importa"].join("\n");
    const result = parseSpreadsheetCsv(text, mapping(["title", "ignore"]));

    expect(result.items[0]!.bodyMarkdown).toBe("");
  });

  it("linha sem título é ignorada e conta no aviso", () => {
    const text = ["Item,Categoria", "Caixas,Embalagem", ",Embalagem"].join("\n");
    const result = parseSpreadsheetCsv(text, mapping(["title", "category"]));

    expect(result.items).toHaveLength(1);
    expect(result.warnings).toEqual(["1 linha(s) sem título foram ignoradas."]);
  });

  it("planilha sem nenhuma linha de dados avisa", () => {
    const result = parseSpreadsheetCsv("Item,Categoria", mapping(["title", "category"]));
    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual(["Nenhuma linha de dados encontrada na planilha."]);
  });

  it("arquivo vazio avisa sem quebrar", () => {
    const result = parseSpreadsheetCsv("", mapping([]));
    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual(["A planilha está vazia."]);
  });

  it("respeita o delimitador ponto e vírgula", () => {
    const text = ["Item;Categoria", "Caixas;Embalagem"].join("\n");
    const result = parseSpreadsheetCsv(text, { delimiter: ";", columns: ["title", "category"] });
    expect(result.items[0]).toMatchObject({ title: "Caixas", categoryLabel: "Embalagem" });
  });
});
