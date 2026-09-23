import { describe, expect, it } from "vitest";
import { extractSeekSeconds, groupHybridResultsByItem, type HybridChunkRow } from "./group-hybrid-results";

function row(overrides: Partial<HybridChunkRow>): HybridChunkRow {
  return { item_id: "item-1", title: "Item", content: "conteúdo", metadata: {}, score: 1, ...overrides };
}

describe("groupHybridResultsByItem", () => {
  it("sem trechos: nenhum resultado", () => {
    expect(groupHybridResultsByItem([], 10)).toEqual([]);
  });

  it("mantém só o primeiro trecho de cada item (já é o de maior score, hybrid_search vem ordenado)", () => {
    const rows = [
      row({ item_id: "a", score: 0.9, content: "melhor trecho de a" }),
      row({ item_id: "b", score: 0.8, content: "melhor trecho de b" }),
      row({ item_id: "a", score: 0.5, content: "pior trecho de a" }),
    ];
    const grouped = groupHybridResultsByItem(rows, 10);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({ itemId: "a", content: "melhor trecho de a" });
    expect(grouped[1]).toMatchObject({ itemId: "b", content: "melhor trecho de b" });
  });

  it("respeita o limite de itens, mesmo com mais trechos disponíveis", () => {
    const rows = [row({ item_id: "a" }), row({ item_id: "b" }), row({ item_id: "c" })];
    expect(groupHybridResultsByItem(rows, 2)).toHaveLength(2);
  });

  it("preserva a ordem de score (primeira ocorrência de cada item já reflete o score mais alto)", () => {
    const rows = [row({ item_id: "b", score: 0.95 }), row({ item_id: "a", score: 0.9 })];
    const grouped = groupHybridResultsByItem(rows, 10);
    expect(grouped.map((r) => r.itemId)).toEqual(["b", "a"]);
  });
});

describe("extractSeekSeconds", () => {
  it("metadata.start numérico: devolve o valor", () => {
    expect(extractSeekSeconds({ start: 750 })).toBe(750);
  });

  it("metadata sem start (chunk de conteúdo/propriedade): null", () => {
    expect(extractSeekSeconds({ title: "X", section: "Y" })).toBeNull();
  });

  it("metadata.start não numérico: null", () => {
    expect(extractSeekSeconds({ start: "750" })).toBeNull();
  });

  it("metadata nula/indefinida: null", () => {
    expect(extractSeekSeconds(null)).toBeNull();
    expect(extractSeekSeconds(undefined)).toBeNull();
  });
});
