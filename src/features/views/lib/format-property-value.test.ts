import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "@/features/types/schemas";
import { formatPropertyValue } from "./format-property-value";

const selectField: FieldDefinition = {
  key: "status",
  label: "Status",
  type: "select",
  required: false,
  options: [
    { id: "a", label: "A fazer" },
    { id: "b", label: "Feito" },
  ],
};

const multiSelectField: FieldDefinition = { ...selectField, key: "tags", type: "multi_select" };
const moneyField: FieldDefinition = { key: "preco", label: "Preço", type: "money", required: false, currency: "BRL" };
const percentField: FieldDefinition = { key: "progresso", label: "Progresso", type: "percent", required: false };
const dateField: FieldDefinition = { key: "prazo", label: "Prazo", type: "date", required: false };
const checkboxField: FieldDefinition = { key: "feito", label: "Feito", type: "checkbox", required: false };
const textField: FieldDefinition = { key: "obs", label: "Obs", type: "text", required: false };

describe("formatPropertyValue", () => {
  it("valor ausente vira travessão", () => {
    expect(formatPropertyValue(undefined, textField)).toBe("—");
    expect(formatPropertyValue(null, textField)).toBe("—");
    expect(formatPropertyValue("", textField)).toBe("—");
  });

  it("checkbox vira Sim/Não", () => {
    expect(formatPropertyValue(true, checkboxField)).toBe("Sim");
    expect(formatPropertyValue(false, checkboxField)).toBe("Não");
  });

  it("select mostra o label da opção, não o id", () => {
    expect(formatPropertyValue("b", selectField)).toBe("Feito");
  });

  it("select com id desconhecido cai pro próprio id", () => {
    expect(formatPropertyValue("x", selectField)).toBe("x");
  });

  it("multi_select junta os labels com vírgula", () => {
    expect(formatPropertyValue(["a", "b"], multiSelectField)).toBe("A fazer, Feito");
  });

  it("money divide por 100 e formata em moeda", () => {
    expect(formatPropertyValue(150000, moneyField)).toContain("1.500,00");
  });

  it("percent acrescenta o símbolo", () => {
    expect(formatPropertyValue(42, percentField)).toBe("42%");
  });

  it("date formata dd/mm/aaaa a partir de AAAA-MM-DD", () => {
    expect(formatPropertyValue("2026-03-05", dateField)).toBe("05/03/2026");
  });

  it("texto simples fica igual", () => {
    expect(formatPropertyValue("nota qualquer", textField)).toBe("nota qualquer");
  });
});
