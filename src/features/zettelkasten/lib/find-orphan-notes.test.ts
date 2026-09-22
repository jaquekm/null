import { describe, expect, it } from "vitest";
import { findOrphanNoteIds } from "./find-orphan-notes";

describe("findOrphanNoteIds", () => {
  it("nota sem saída e sem entrada é órfã", () => {
    const notes = [{ id: "a", outgoingIds: [] }];
    expect(findOrphanNoteIds(notes)).toEqual(["a"]);
  });

  it("nota que aponta pra outra não é órfã, mesmo sem ninguém apontar pra ela", () => {
    const notes = [
      { id: "a", outgoingIds: ["b"] },
      { id: "b", outgoingIds: [] },
    ];
    // "b" recebe link de "a", então não é órfã; "a" tem saída, também não.
    expect(findOrphanNoteIds(notes)).toEqual([]);
  });

  it("nota referenciada por outra não é órfã", () => {
    const notes = [
      { id: "a", outgoingIds: ["b"] },
      { id: "b", outgoingIds: ["c"] },
      { id: "c", outgoingIds: [] },
    ];
    expect(findOrphanNoteIds(notes)).toEqual([]);
  });

  it("mistura de notas conectadas e órfãs", () => {
    const notes = [
      { id: "a", outgoingIds: ["b"] },
      { id: "b", outgoingIds: [] },
      { id: "orfa1", outgoingIds: [] },
      { id: "orfa2", outgoingIds: [] },
    ];
    expect(findOrphanNoteIds(notes)).toEqual(["orfa1", "orfa2"]);
  });

  it("lista vazia: nenhuma órfã", () => {
    expect(findOrphanNoteIds([])).toEqual([]);
  });
});
