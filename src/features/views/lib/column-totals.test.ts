import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "@/features/types/schemas";
import { defaultAgg, formatTotal, isTotalable, summarizeColumns, totalValue } from "./column-totals";

const f = (patch: Partial<FieldDefinition> & Pick<FieldDefinition, "key" | "type">): FieldDefinition => ({ label: patch.key, required: false, ...patch });

const FIELDS = [
  f({ key: "qtd", type: "number" }),
  f({ key: "preco", type: "money" }),
  f({ key: "nota", type: "rating" }),
  f({ key: "desc", type: "percent" }),
  f({ key: "total", type: "formula", formulaFormat: "money" }),
  f({ key: "obs", type: "text" }),
];

const ROWS = [
  { qtd: 2, preco: 1050, nota: 4, desc: 10, total: 2100, obs: "a" },
  { qtd: 3, preco: 999, nota: 5, total: 2997 },
  { qtd: "1", preco: null, desc: 20, total: null },
];

describe("summarizeColumns", () => {
  it("soma e conta só valores numéricos, por coluna numérica", () => {
    const summary = summarizeColumns(ROWS, FIELDS);
    expect(summary.qtd).toEqual({ sum: 6, count: 3 });
    expect(summary.preco).toEqual({ sum: 2049, count: 2 });
    expect(summary.total).toEqual({ sum: 5097, count: 2 });
    expect(summary.obs).toBeUndefined();
  });
});

describe("totalValue / formatTotal", () => {
  const summary = summarizeColumns(ROWS, FIELDS);
  const field = (key: string) => FIELDS.find((x) => x.key === key)!;

  it("soma de dinheiro em reais", () => {
    expect(formatTotal(summary.preco, "sum", field("preco"))).toBe("R$ 20,49");
    expect(formatTotal(summary.total, "sum", field("total"))).toBe("R$ 50,97");
  });

  it("média de dinheiro arredonda pro centavo", () => {
    expect(totalValue(summary.preco, "avg")).toBe(1024.5);
    expect(formatTotal(summary.preco, "avg", field("preco"))).toBe("R$ 10,25");
  });

  it("média de nota e de porcentagem", () => {
    expect(formatTotal(summary.nota, "avg", field("nota"))).toBe("4,5");
    expect(formatTotal(summary.desc, "avg", field("desc"))).toBe("15%");
  });

  it("contagem é quantas linhas têm valor", () => {
    expect(formatTotal(summary.preco, "count", field("preco"))).toBe("2");
  });

  it("sem valores → travessão; 'nenhum' → vazio", () => {
    const empty = summarizeColumns([{}], FIELDS);
    expect(formatTotal(empty.qtd, "sum", field("qtd"))).toBe("—");
    expect(formatTotal(empty.qtd, "count", field("qtd"))).toBe("0");
    expect(formatTotal(summary.qtd, "none", field("qtd"))).toBe("");
  });
});

describe("defaultAgg / isTotalable", () => {
  it("nota e porcentagem em média; o resto em soma", () => {
    expect(defaultAgg(f({ key: "a", type: "rating" }))).toBe("avg");
    expect(defaultAgg(f({ key: "a", type: "percent" }))).toBe("avg");
    expect(defaultAgg(f({ key: "a", type: "formula", formulaFormat: "percent" }))).toBe("avg");
    expect(defaultAgg(f({ key: "a", type: "money" }))).toBe("sum");
  });

  it("só colunas numéricas têm total", () => {
    expect(isTotalable(f({ key: "a", type: "text" }))).toBe(false);
    expect(isTotalable(f({ key: "a", type: "formula" }))).toBe(true);
  });
});
