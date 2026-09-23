import { describe, expect, it } from "vitest";
import { buildAskContext, selectChunksWithinBudget, type RetrievedChunk, type ItemLabel } from "./ask-context";

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: "chunk-1",
    itemId: "item-1",
    title: "Item",
    content: "conteúdo",
    metadata: {},
    score: 1,
    ...overrides,
  };
}

describe("selectChunksWithinBudget", () => {
  it("mantém a ordem (já vem por score) mas limita trechos por item", () => {
    const chunks = [
      chunk({ chunkId: "a1", itemId: "item-1" }),
      chunk({ chunkId: "a2", itemId: "item-1" }),
      chunk({ chunkId: "a3", itemId: "item-1" }),
      chunk({ chunkId: "a4", itemId: "item-1" }),
      chunk({ chunkId: "a5", itemId: "item-1" }),
      chunk({ chunkId: "b1", itemId: "item-2" }),
    ];

    const selected = selectChunksWithinBudget(chunks, 100000, 4);

    expect(selected.map((c) => c.chunkId)).toEqual(["a1", "a2", "a3", "a4", "b1"]);
  });

  it("pula trechos que estourariam o orçamento, sem interromper o laço", () => {
    const big = "x".repeat(4000); // ~1000 tokens
    const small = "y".repeat(40); // ~10 tokens
    const chunks = [chunk({ chunkId: "big", content: big }), chunk({ chunkId: "small", itemId: "item-2", content: small })];

    const selected = selectChunksWithinBudget(chunks, 500, 4);

    expect(selected.map((c) => c.chunkId)).toEqual(["small"]);
  });

  it("sem trechos: lista vazia", () => {
    expect(selectChunksWithinBudget([], 1000, 4)).toEqual([]);
  });
});

describe("buildAskContext", () => {
  it("numera as fontes e inclui tipo, espaço e localização no cabeçalho", () => {
    const chunks = [chunk({ chunkId: "c1", itemId: "item-1", title: "Reunião com Acme", content: "Discutimos o contrato.", metadata: { start: 800 } })];
    const labels = new Map<string, ItemLabel>([["item-1", { title: "Reunião com Acme", typeName: "Reunião", spaceName: "Empresa X" }]]);

    const { contextText, sources } = buildAskContext(chunks, labels);

    expect(contextText).toContain('[1] Item: "Reunião com Acme" (Reunião, espaço Empresa X) — trecho 00:13:20');
    expect(contextText).toContain("Discutimos o contrato.");
    expect(sources).toEqual([
      { n: 1, chunkId: "c1", itemId: "item-1", title: "Reunião com Acme", excerpt: "Discutimos o contrato.", location: "trecho 00:13:20", seekSeconds: 800, page: null },
    ]);
  });

  it("sem rótulo de item (não encontrado): usa o título do trecho e omite tipo/espaço", () => {
    const chunks = [chunk({ chunkId: "c1", itemId: "item-1", title: "Item sem rótulo" })];

    const { contextText } = buildAskContext(chunks, new Map());

    expect(contextText).toContain('[1] Item: "Item sem rótulo"');
    expect(contextText).not.toContain("(");
  });

  it("trecho longo: prévia cortada em 240 caracteres com reticências", () => {
    const longContent = "a".repeat(300);
    const chunks = [chunk({ content: longContent })];

    const { sources } = buildAskContext(chunks, new Map());

    expect(sources[0]!.excerpt).toHaveLength(241);
    expect(sources[0]!.excerpt.endsWith("…")).toBe(true);
  });

  it("sem trechos: contexto vazio e sem fontes", () => {
    expect(buildAskContext([], new Map())).toEqual({ contextText: "", sources: [] });
  });
});
