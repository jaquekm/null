import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "@/features/types/schemas";
import { ensureSelectFieldWithOptions } from "./resolve-select-field";

describe("ensureSelectFieldWithOptions", () => {
  it("cria o campo select do zero quando o tipo ainda não tem um com esse rótulo", () => {
    const result = ensureSelectFieldWithOptions([], "Categoria", ["Embalagem", "Móveis"]);

    const field = result.fields.find((f) => f.key === result.fieldKey)!;
    expect(field.label).toBe("Categoria");
    expect(field.type).toBe("select");
    expect(field.options?.map((o) => o.label).sort()).toEqual(["Embalagem", "Móveis"]);
  });

  it("reaproveita um campo select já existente com o mesmo rótulo (sem diferenciar maiúscula/minúscula)", () => {
    const existing: FieldDefinition[] = [{ key: "categoria", label: "categoria", type: "select", required: false, options: [{ id: "opt-1", label: "Embalagem" }] }];

    const result = ensureSelectFieldWithOptions(existing, "Categoria", ["Embalagem", "Móveis"]);

    expect(result.fields).toHaveLength(1);
    expect(result.fieldKey).toBe("categoria");
    const field = result.fields[0]!;
    expect(field.options).toHaveLength(2);
    expect(field.options?.find((o) => o.label === "Embalagem")?.id).toBe("opt-1");
  });

  it("não cria opção duplicada pra rótulos iguais ignorando espaços/caixa", () => {
    const result = ensureSelectFieldWithOptions([], "Categoria", ["Embalagem", " embalagem ", "EMBALAGEM"]);
    const field = result.fields.find((f) => f.key === result.fieldKey)!;
    expect(field.options).toHaveLength(1);
  });

  it("optionIdByLabel resolve pelo rótulo normalizado (trim + minúsculo)", () => {
    const result = ensureSelectFieldWithOptions([], "Categoria", ["Embalagem"]);
    const id = result.optionIdByLabel.get("embalagem");
    expect(id).toBeDefined();
    expect(result.fields[0]!.options?.[0]!.id).toBe(id);
  });

  it("ignora rótulos vazios", () => {
    const result = ensureSelectFieldWithOptions([], "Categoria", ["  ", ""]);
    const field = result.fields.find((f) => f.key === result.fieldKey)!;
    expect(field.options).toEqual([]);
  });

  it("preserva outros campos do tipo intactos", () => {
    const existing: FieldDefinition[] = [{ key: "prazo", label: "Prazo", type: "date", required: false }];
    const result = ensureSelectFieldWithOptions(existing, "Categoria", ["Embalagem"]);
    expect(result.fields.find((f) => f.key === "prazo")).toEqual(existing[0]);
  });
});
