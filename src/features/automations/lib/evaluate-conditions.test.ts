import { describe, expect, it } from "vitest";
import { evaluateCondition, evaluateConditions, matchesOperator, type ConditionItem } from "./evaluate-conditions";

function item(overrides: Partial<ConditionItem> = {}): ConditionItem {
  return { title: "Oportunidade X", status: "active", properties: { stage: "won", value: 100 }, ...overrides };
}

describe("evaluateCondition", () => {
  it("eq compara propriedade e campo comum", () => {
    expect(evaluateCondition(item(), { field: "stage", op: "eq", value: "won" })).toBe(true);
    expect(evaluateCondition(item(), { field: "status", op: "eq", value: "archived" })).toBe(false);
  });

  it("contains é case-insensitive no título", () => {
    expect(evaluateCondition(item(), { field: "title", op: "contains", value: "oportunidade" })).toBe(true);
    expect(evaluateCondition(item(), { field: "title", op: "contains", value: "zzz" })).toBe(false);
  });

  it("gt/lt em número", () => {
    expect(evaluateCondition(item(), { field: "value", op: "gt", value: 50 })).toBe(true);
    expect(evaluateCondition(item(), { field: "value", op: "lt", value: 50 })).toBe(false);
  });

  it("empty/not_empty", () => {
    expect(evaluateCondition(item({ properties: {} }), { field: "stage", op: "empty", value: undefined })).toBe(true);
    expect(evaluateCondition(item(), { field: "stage", op: "not_empty", value: undefined })).toBe(true);
  });

  it("any_of", () => {
    expect(evaluateCondition(item(), { field: "stage", op: "any_of", value: ["won", "lost"] })).toBe(true);
    expect(evaluateCondition(item(), { field: "stage", op: "any_of", value: ["lost"] })).toBe(false);
  });

  it("between", () => {
    expect(evaluateCondition(item(), { field: "value", op: "between", value: [50, 150] })).toBe(true);
    expect(evaluateCondition(item(), { field: "value", op: "between", value: [150, 200] })).toBe(false);
  });
});

describe("matchesOperator", () => {
  it("compara um valor já resolvido, sem depender de um ConditionItem inteiro (reaproveitado por computeRollup)", () => {
    expect(matchesOperator("done", { op: "eq", value: "done" })).toBe(true);
    expect(matchesOperator(10, { op: "gt", value: 5 })).toBe(true);
  });
});

describe("evaluateConditions", () => {
  it("lista vazia sempre passa", () => {
    expect(evaluateConditions(item(), [])).toBe(true);
  });

  it("todas as condições precisam passar (E lógico)", () => {
    expect(
      evaluateConditions(item(), [
        { field: "stage", op: "eq", value: "won" },
        { field: "value", op: "gt", value: 1000 },
      ]),
    ).toBe(false);
  });
});
