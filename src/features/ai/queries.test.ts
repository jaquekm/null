import { describe, expect, it, vi } from "vitest";
import { listRelatedItems } from "./queries";

interface FakeConfig {
  chunks?: { embedding: number[] }[];
  links?: { source_id: string; target_id: string }[];
  candidates?: { item_id: string; title: string; distance: number }[];
}

function fakeSupabase(config: FakeConfig) {
  const rpc = vi.fn().mockResolvedValue({ data: config.candidates ?? [], error: null });

  const client = {
    from: (table: string) => {
      if (table === "item_chunks") {
        return { select: () => ({ eq: () => ({ not: () => Promise.resolve({ data: config.chunks ?? [] }) }) }) };
      }
      if (table === "links") {
        return { select: () => ({ or: () => Promise.resolve({ data: config.links ?? [] }) }) };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
    rpc,
  };
  return { client: client as never, rpc };
}

const ITEM_ID = "item-1";

describe("listRelatedItems", () => {
  it("item sem nenhum trecho indexado: nenhum relacionado, RPC nem é chamada", async () => {
    const { client, rpc } = fakeSupabase({ chunks: [] });

    const result = await listRelatedItems(client, ITEM_ID);

    expect(result).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("chama related_items com a média dos embeddings e o limite ajustado pelos já ligados", async () => {
    const { client, rpc } = fakeSupabase({
      chunks: [{ embedding: [1, 0] }, { embedding: [0, 1] }],
      links: [{ source_id: ITEM_ID, target_id: "already-linked" }],
      candidates: [{ item_id: "related-1", title: "Relacionado 1", distance: 0.1 }],
    });

    const result = await listRelatedItems(client, ITEM_ID);

    expect(rpc).toHaveBeenCalledWith(
      "related_items",
      expect.objectContaining({ p_item_id: ITEM_ID, p_embedding: [0.5, 0.5], p_limit: 5 + 1 }),
    );
    expect(result).toEqual([{ id: "related-1", title: "Relacionado 1" }]);
  });

  it("exclui itens já ligados (nas duas direções) dos candidatos devolvidos", async () => {
    const { client } = fakeSupabase({
      chunks: [{ embedding: [1, 0] }],
      links: [
        { source_id: ITEM_ID, target_id: "linked-as-target" },
        { source_id: "linked-as-source", target_id: ITEM_ID },
      ],
      candidates: [
        { item_id: "linked-as-target", title: "Já ligado (alvo)", distance: 0.05 },
        { item_id: "linked-as-source", title: "Já ligado (origem)", distance: 0.06 },
        { item_id: "novo", title: "Candidato novo", distance: 0.1 },
      ],
    });

    const result = await listRelatedItems(client, ITEM_ID);

    expect(result).toEqual([{ id: "novo", title: "Candidato novo" }]);
  });

  it("respeita o limite de 5 relacionados depois do filtro", async () => {
    const candidates = Array.from({ length: 8 }, (_, i) => ({ item_id: `item-${i}`, title: `Item ${i}`, distance: i / 10 }));
    const { client } = fakeSupabase({ chunks: [{ embedding: [1] }], candidates });

    const result = await listRelatedItems(client, ITEM_ID);

    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ id: "item-0", title: "Item 0" });
  });
});
