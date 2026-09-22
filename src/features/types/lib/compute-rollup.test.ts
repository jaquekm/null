import { describe, expect, it } from "vitest";
import type { RollupRelatedItem } from "./compute-rollup";
import { computeRollup } from "./compute-rollup";

function task(overrides: Partial<RollupRelatedItem> = {}): RollupRelatedItem {
  return { properties: {}, ...overrides };
}

describe("computeRollup", () => {
  it("count: conta todos os itens relacionados sem condição", () => {
    const items = [task(), task(), task()];
    expect(computeRollup(items, { op: "count" })).toBe(3);
  });

  it("count: conta só os itens que atendem a condição", () => {
    const items = [
      task({ properties: { stage: "concluida" } }),
      task({ properties: { stage: "concluida" } }),
      task({ properties: { stage: "pendente" } }),
    ];
    expect(computeRollup(items, { op: "count", condition: { field: "stage", op: "eq", value: "concluida" } })).toBe(2);
  });

  it("condição lê sempre de `properties` — nunca colide com a coluna `items.status` (Tarefa tem um campo chamado `status`)", () => {
    const items = [task({ properties: { status: "done" } }), task({ properties: { status: "todo" } })];
    expect(computeRollup(items, { op: "count", condition: { field: "status", op: "eq", value: "done" } })).toBe(1);
  });

  it("sum: soma o campo alvo dos itens que atendem a condição", () => {
    const items = [
      task({ properties: { estimate: 60, billable: true } }),
      task({ properties: { estimate: 30, billable: true } }),
      task({ properties: { estimate: 90, billable: false } }),
    ];
    expect(
      computeRollup(items, { op: "sum", targetField: "estimate", condition: { field: "billable", op: "eq", value: true } }),
    ).toBe(90);
  });

  it("sum: sem targetField retorna 0", () => {
    expect(computeRollup([task({ properties: { estimate: 10 } })], { op: "sum" })).toBe(0);
  });

  it("sum: ignora valores não numéricos do campo alvo", () => {
    const items = [task({ properties: { estimate: 10 } }), task({ properties: { estimate: "não é número" } })];
    expect(computeRollup(items, { op: "sum", targetField: "estimate" })).toBe(10);
  });

  it("percent: proporção de itens que atendem a condição, arredondada", () => {
    const items = [
      task({ properties: { stage: "done" } }),
      task({ properties: { stage: "done" } }),
      task({ properties: { stage: "todo" } }),
    ];
    expect(computeRollup(items, { op: "percent", condition: { field: "stage", op: "eq", value: "done" } })).toBe(67);
  });

  it("percent: sem itens relacionados retorna 0 (evita divisão por zero)", () => {
    expect(computeRollup([], { op: "percent", condition: { field: "stage", op: "eq", value: "done" } })).toBe(0);
  });

  it("percent: sem condição, todos contam como atendendo", () => {
    expect(computeRollup([task(), task()], { op: "percent" })).toBe(100);
  });
});
