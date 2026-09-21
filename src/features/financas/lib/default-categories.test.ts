import { describe, expect, it } from "vitest";
import { computeMissingChildCategories, computeMissingTopCategories, type DefaultCategoryGroup, type ExistingCategory } from "./default-categories";

const DEFAULTS: DefaultCategoryGroup[] = [
  { name: "Moradia", kind: "expense", children: ["Aluguel", "Energia"] },
  { name: "Lazer", kind: "expense", children: [] },
  { name: "Salário", kind: "income", children: [] },
  { name: "Outros", kind: "expense", children: [] },
  { name: "Outros", kind: "income", children: [] },
];

describe("computeMissingTopCategories", () => {
  it("nenhuma categoria existente: todas as de topo faltam", () => {
    const result = computeMissingTopCategories([], DEFAULTS);
    expect(result).toEqual([
      { name: "Moradia", kind: "expense" },
      { name: "Lazer", kind: "expense" },
      { name: "Salário", kind: "income" },
      { name: "Outros", kind: "expense" },
      { name: "Outros", kind: "income" },
    ]);
  });

  it("categoria já existe (mesmo kind e nome): não repete", () => {
    const existing: ExistingCategory[] = [{ id: "1", parentId: null, name: "Moradia", kind: "expense" }];
    const result = computeMissingTopCategories(existing, DEFAULTS);
    expect(result.find((g) => g.name === "Moradia")).toBeUndefined();
    expect(result).toHaveLength(4);
  });

  it("'Outros' de despesa e de receita são categorias distintas (kind diferente)", () => {
    const existing: ExistingCategory[] = [{ id: "1", parentId: null, name: "Outros", kind: "expense" }];
    const result = computeMissingTopCategories(existing, DEFAULTS);
    expect(result.find((g) => g.name === "Outros" && g.kind === "income")).toBeDefined();
    expect(result.find((g) => g.name === "Outros" && g.kind === "expense")).toBeUndefined();
  });

  it("categoria com o mesmo nome mas filha (parent_id preenchido) não conta como 'já existe' de topo", () => {
    const existing: ExistingCategory[] = [{ id: "1", parentId: "outro-id", name: "Moradia", kind: "expense" }];
    const result = computeMissingTopCategories(existing, DEFAULTS);
    expect(result.find((g) => g.name === "Moradia")).toBeDefined();
  });

  it("categorias já criadas pelo dono, fora da lista padrão, não afetam o resultado", () => {
    const existing: ExistingCategory[] = [{ id: "1", parentId: null, name: "Categoria Própria", kind: "expense" }];
    const result = computeMissingTopCategories(existing, DEFAULTS);
    expect(result).toHaveLength(5);
  });
});

describe("computeMissingChildCategories", () => {
  const topIdByKey = new Map([
    ["expense:Moradia", "id-moradia"],
    ["expense:Lazer", "id-lazer"],
  ]);

  it("nenhuma existente: todas as filhas do grupo mapeado", () => {
    const result = computeMissingChildCategories([], topIdByKey, DEFAULTS);
    expect(result).toEqual([
      { parentId: "id-moradia", name: "Aluguel", kind: "expense" },
      { parentId: "id-moradia", name: "Energia", kind: "expense" },
    ]);
  });

  it("filha já existe sob o mesmo pai: não repete", () => {
    const existing: ExistingCategory[] = [{ id: "1", parentId: "id-moradia", name: "Aluguel", kind: "expense" }];
    const result = computeMissingChildCategories(existing, topIdByKey, DEFAULTS);
    expect(result).toEqual([{ parentId: "id-moradia", name: "Energia", kind: "expense" }]);
  });

  it("grupo de topo ainda não tem id mapeado (ainda não foi criado): filhas dele ficam de fora", () => {
    const partialMap = new Map([["expense:Moradia", "id-moradia"]]);
    const result = computeMissingChildCategories([], partialMap, [{ name: "Salário", kind: "income", children: ["Bônus"] }, ...DEFAULTS]);
    expect(result.find((c) => c.name === "Bônus")).toBeUndefined();
  });

  it("nome igual mas sob outro pai não conta como duplicata", () => {
    const existing: ExistingCategory[] = [{ id: "1", parentId: "outro-pai", name: "Aluguel", kind: "expense" }];
    const result = computeMissingChildCategories(existing, topIdByKey, DEFAULTS);
    expect(result.find((c) => c.parentId === "id-moradia" && c.name === "Aluguel")).toBeDefined();
  });
});
