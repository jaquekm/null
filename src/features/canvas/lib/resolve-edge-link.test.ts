import { describe, expect, it } from "vitest";
import { resolveEdgeLink } from "./resolve-edge-link";

describe("resolveEdgeLink", () => {
  it("dois nós de item com ids diferentes: resolve o link na mesma direção", () => {
    const result = resolveEdgeLink({ kind: "item", itemId: "item-a" }, { kind: "item", itemId: "item-b" });
    expect(result).toEqual({ sourceItemId: "item-a", targetItemId: "item-b" });
  });

  it("origem não é nó de item: não resolve", () => {
    expect(resolveEdgeLink({ kind: "text", itemId: null }, { kind: "item", itemId: "item-b" })).toBeNull();
  });

  it("destino não é nó de item: não resolve", () => {
    expect(resolveEdgeLink({ kind: "item", itemId: "item-a" }, { kind: "group", itemId: null })).toBeNull();
  });

  it("nenhum dos dois é nó de item: não resolve", () => {
    expect(resolveEdgeLink({ kind: "text", itemId: null }, { kind: "link", itemId: null })).toBeNull();
  });

  it("nó de item sem itemId (defensivo, não deveria acontecer): não resolve", () => {
    expect(resolveEdgeLink({ kind: "item", itemId: null }, { kind: "item", itemId: "item-b" })).toBeNull();
  });

  it("mesmo item nos dois lados (self-loop): não resolve", () => {
    expect(resolveEdgeLink({ kind: "item", itemId: "item-a" }, { kind: "item", itemId: "item-a" })).toBeNull();
  });
});
