import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "../schemas";
import { computeFormulas, validateFormula } from "./formula";

const field = (patch: Partial<FieldDefinition> & Pick<FieldDefinition, "key" | "label" | "type">): FieldDefinition => ({ required: false, ...patch });

const FIELDS: FieldDefinition[] = [
  field({ key: "quantidade", label: "Quantidade", type: "number" }),
  field({ key: "preco", label: "Preço unitário", type: "money" }),
  field({ key: "desconto", label: "Desconto", type: "percent" }),
  field({ key: "custo", label: "Custo", type: "money" }),
  field({ key: "obs", label: "Observação", type: "text" }),
];

function run(formula: string, format: FieldDefinition["formulaFormat"], properties: Record<string, unknown>) {
  const withFormula = [...FIELDS, field({ key: "total", label: "Total", type: "formula", formula, formulaFormat: format })];
  return computeFormulas(withFormula, properties).total;
}

describe("computeFormulas", () => {
  it("quantidade × preço em dinheiro (centavos)", () => {
    expect(run("Quantidade × Preço unitário", "money", { quantidade: 3, preco: 1250 })).toBe(3750);
    expect(run("quantidade * preco", "money", { quantidade: 3, preco: 1250 })).toBe(3750);
  });

  it("porcentagem entra como fração e volta ×100", () => {
    expect(run("preco * (1 - desconto)", "money", { preco: 10000, desconto: 15 })).toBe(8500);
    expect(run("(preco - custo) / preco", "percent", { preco: 10000, custo: 7500 })).toBe(25);
  });

  it("números com vírgula e precedência", () => {
    expect(run("2 + 3 * 4", "number", {})).toBe(14);
    expect(run("(2 + 3) * 4", "number", {})).toBe(20);
    expect(run("quantidade * 1,5", "number", { quantidade: 4 })).toBe(6);
    expect(run("1.234,5 + 0,5", "number", {})).toBe(1235);
    expect(run("-quantidade + 10", "number", { quantidade: 4 })).toBe(6);
    expect(run("10 ÷ 4", "number", {})).toBe(2.5);
  });

  it("arredonda dinheiro pro centavo", () => {
    expect(run("preco / 3", "money", { preco: 1000 })).toBe(333);
  });

  it("campo vazio ou divisão por zero → sem valor", () => {
    expect(run("quantidade * preco", "money", { quantidade: 3 })).toBeNull();
    expect(run("preco / quantidade", "money", { preco: 100, quantidade: 0 })).toBeNull();
  });

  it("fórmula quebrada não derruba: sem valor", () => {
    expect(run("quantidade *", "number", { quantidade: 1 })).toBeNull();
  });

  it("sem campos de fórmula → objeto vazio", () => {
    expect(computeFormulas(FIELDS, { quantidade: 1 })).toEqual({});
  });
});

describe("validateFormula", () => {
  it("campo novo (sem chave ainda): nome que não existe é 'não achei', não 'ela mesma'", () => {
    expect(validateFormula("quantidade * frete", FIELDS)).toBe("Não achei o campo “frete”.");
  });

  it.each([
    ["quantidade * preco", null],
    ["Quantidade × Preço unitário", null],
    ["", "A fórmula está vazia."],
    ["quantidade *", "A fórmula terminou no meio da conta."],
    ["(quantidade * preco", "Falta fechar um parêntese."],
    ["quantidade * preco)", "Tem um parêntese fechando sem abrir."],
    ["quantidade preco", "Não achei o campo “quantidade preco”."],
    ["quantidade * frete", "Não achei o campo “frete”."],
    ["obs * 2", "“Observação” não é um campo de número, dinheiro ou porcentagem."],
    ["total * 2", "A fórmula não pode usar ela mesma."],
    ["quantidade % 2", "Não entendi o caractere “%”."],
  ])("%s → %s", (formula, error) => {
    const withSelf = [...FIELDS, field({ key: "total", label: "Total", type: "formula" })];
    expect(validateFormula(formula, withSelf, "total")).toBe(error);
  });
});
