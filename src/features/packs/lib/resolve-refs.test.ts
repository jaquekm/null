import { describe, expect, it } from "vitest";
import { invertTypeRefs, resolveTypeRefs } from "./resolve-refs";

describe("resolveTypeRefs", () => {
  it("troca typeRef por typeId em qualquer profundidade", () => {
    const value = {
      type: "create_item",
      typeRef: "task",
      nested: [{ condition: { typeRef: "opportunity" } }],
    };
    const resolved = resolveTypeRefs(value, { task: "id-task", opportunity: "id-opp" });
    expect(resolved).toEqual({
      type: "create_item",
      typeId: "id-task",
      nested: [{ condition: { typeId: "id-opp" } }],
    });
  });

  it("typeRef sem correspondência vira typeId null", () => {
    const resolved = resolveTypeRefs({ typeRef: "fantasma" }, {});
    expect(resolved).toEqual({ typeId: null });
  });

  it("valores sem typeRef passam intactos", () => {
    const value = { field: "stage", op: "eq", value: "won" };
    expect(resolveTypeRefs(value, { stage: "x" })).toEqual(value);
  });
});

describe("invertTypeRefs", () => {
  it("troca typeId por typeRef quando o id está na seleção exportada", () => {
    const value = { typeId: "id-task", nested: [{ typeId: "id-opp" }] };
    const inverted = invertTypeRefs(value, { "id-task": "task", "id-opp": "opportunity" });
    expect(inverted).toEqual({ typeRef: "task", nested: [{ typeRef: "opportunity" }] });
  });

  it("typeId fora da seleção fica como está", () => {
    const value = { typeId: "id-externo" };
    expect(invertTypeRefs(value, { "id-task": "task" })).toEqual({ typeId: "id-externo" });
  });

  it("é o inverso exato de resolveTypeRefs num round-trip", () => {
    const original = { typeRef: "task", nested: [{ typeRef: "opportunity" }] };
    const typeIdByRef = { task: "id-task", opportunity: "id-opp" };
    const refByTypeId = { "id-task": "task", "id-opp": "opportunity" };
    const resolved = resolveTypeRefs(original, typeIdByRef);
    expect(invertTypeRefs(resolved, refByTypeId)).toEqual(original);
  });
});
