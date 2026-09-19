import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "@/features/types/schemas";
import { resolveFilter, resolveFilterColumn } from "./resolve-filter";

const textField: FieldDefinition = { key: "empresa", label: "Empresa", type: "text", required: false };
const numberField: FieldDefinition = { key: "preco", label: "Preço", type: "money", required: false };
const dateField: FieldDefinition = { key: "prazo", label: "Prazo", type: "date", required: false };

describe("resolveFilterColumn", () => {
  it("campo comum vira a própria coluna, sem prefixo", () => {
    expect(resolveFilterColumn("title")).toBe("title");
    expect(resolveFilterColumn("status")).toBe("status");
  });

  it("campo de properties sem cast numérico", () => {
    expect(resolveFilterColumn("empresa", textField)).toBe("properties->>empresa");
  });

  it("campo numérico (money/number/percent/rating/duration) ganha cast ::numeric", () => {
    expect(resolveFilterColumn("preco", numberField)).toBe("properties->>preco::numeric");
  });

  it("campo de data não ganha cast — string ISO já compara certo como texto", () => {
    expect(resolveFilterColumn("prazo", dateField)).toBe("properties->>prazo");
  });
});

describe("resolveFilter", () => {
  it("contains vira ilike com % nas pontas", () => {
    expect(resolveFilter({ field: "title", op: "contains", value: "reunião" })).toEqual([
      { column: "title", op: "ilike", value: "%reunião%" },
    ]);
  });

  it("eq/neq/gt/lt passam o valor direto", () => {
    expect(resolveFilter({ field: "preco", op: "gt", value: 100 }, numberField)).toEqual([
      { column: "properties->>preco::numeric", op: "gt", value: 100 },
    ]);
  });

  it("between com os dois lados vira duas comparações gte+lte", () => {
    expect(resolveFilter({ field: "preco", op: "between", value: [100, 200] }, numberField)).toEqual([
      { column: "properties->>preco::numeric", op: "gte", value: 100 },
      { column: "properties->>preco::numeric", op: "lte", value: 200 },
    ]);
  });

  it("between só com um lado preenchido vira só uma comparação", () => {
    expect(resolveFilter({ field: "preco", op: "between", value: [100, undefined] }, numberField)).toEqual([
      { column: "properties->>preco::numeric", op: "gte", value: 100 },
    ]);
  });

  it("empty vira is null", () => {
    expect(resolveFilter({ field: "empresa", op: "empty" }, textField)).toEqual([
      { column: "properties->>empresa", op: "is", value: null },
    ]);
  });

  it("not_empty vira is null negado", () => {
    expect(resolveFilter({ field: "empresa", op: "not_empty" }, textField)).toEqual([
      { column: "properties->>empresa", op: "is", value: null, negate: true },
    ]);
  });

  it("any_of vira in com a lista de valores", () => {
    expect(resolveFilter({ field: "status", op: "any_of", value: ["active", "archived"] })).toEqual([
      { column: "status", op: "in", value: ["active", "archived"] },
    ]);
  });

  it("any_of sem array vira lista vazia (não quebra, só não bate com nada)", () => {
    expect(resolveFilter({ field: "status", op: "any_of", value: "active" })).toEqual([
      { column: "status", op: "in", value: [] },
    ]);
  });

  it("data (date) usa a coluna sem cast", () => {
    expect(resolveFilter({ field: "prazo", op: "gt", value: "2026-01-01" }, dateField)).toEqual([
      { column: "properties->>prazo", op: "gt", value: "2026-01-01" },
    ]);
  });
});
