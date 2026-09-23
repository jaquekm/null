import "server-only";
import type { ItemLabel, RetrievedChunk } from "@/features/ai/lib/ask-context";
import { cosineSimilarity } from "@/features/ai/lib/cosine-similarity";
import { isWithinPeriodUtc, periodBoundsUtc } from "@/features/ai/lib/period-filter";
import type { Client } from "@/features/ai/types";
import { getEmbeddingsProvider } from "@/lib/embeddings";

export interface AskScope {
  spaceIds?: string[];
  typeIds?: string[];
  /** `YYYY-MM-DD`, dia local do dono — filtra por `items.updated_at` (`hybrid_search` não tem parâmetro de período). */
  dateFrom?: string;
  dateTo?: string;
  /** Escopo "este item e relacionados" (painel lateral, 6.7) — ids fixos, ignora os demais campos (`hybrid_search` não aceita lista de item ids, e o painel não tem filtro de período). */
  itemIds?: string[];
}

const RETRIEVE_CHUNK_LIMIT = 20;

/**
 * Recupera os trechos mais relevantes pra pergunta reformulada (6.7, passo 3).
 * Escopo por item (painel lateral) não passa por `hybrid_search` — a RPC só
 * filtra por espaço/tipo — em vez disso busca os trechos desses itens direto
 * e ranqueia por similaridade de cosseno em JS (conjunto pequeno e já
 * limitado, não precisa de RPC nova). Sem provedor de embeddings (ou a
 * chamada falhando), devolve vazio — quem chama trata como "sem fontes".
 */
export async function retrieveChunks(supabase: Client, query: string, scope: AskScope, timezone: string): Promise<RetrievedChunk[]> {
  const provider = getEmbeddingsProvider();
  if (!provider) return [];

  let queryEmbedding: number[];
  try {
    queryEmbedding = await provider.embedQuery(query);
  } catch {
    return [];
  }

  if (scope.itemIds && scope.itemIds.length > 0) {
    return retrieveFromItemIds(supabase, queryEmbedding, scope.itemIds);
  }

  const { data, error } = await supabase.rpc("hybrid_search", {
    q: query,
    q_embedding: queryEmbedding as unknown as string,
    p_space_ids: scope.spaceIds && scope.spaceIds.length > 0 ? scope.spaceIds : undefined,
    p_type_ids: scope.typeIds && scope.typeIds.length > 0 ? scope.typeIds : undefined,
    p_limit: RETRIEVE_CHUNK_LIMIT,
  });
  if (error || !data) return [];

  const rows = scope.dateFrom || scope.dateTo ? await filterByPeriod(supabase, data, scope, timezone) : data;

  return rows.map((row) => ({ chunkId: row.chunk_id, itemId: row.item_id, title: row.title, content: row.content, metadata: row.metadata, score: row.score }));
}

interface HybridRow {
  chunk_id: string;
  item_id: string;
  title: string;
  content: string;
  metadata: unknown;
  score: number;
}

async function filterByPeriod(supabase: Client, rows: HybridRow[], scope: Pick<AskScope, "dateFrom" | "dateTo">, timezone: string): Promise<HybridRow[]> {
  const bounds = periodBoundsUtc(scope.dateFrom, scope.dateTo, timezone);

  const { data: items } = await supabase
    .from("items")
    .select("id, updated_at")
    .in("id", [...new Set(rows.map((row) => row.item_id))]);
  const updatedAtById = new Map((items ?? []).map((item) => [item.id, item.updated_at]));

  return rows.filter((row) => {
    const updatedAt = updatedAtById.get(row.item_id);
    return updatedAt != null && isWithinPeriodUtc(updatedAt, bounds);
  });
}

async function retrieveFromItemIds(supabase: Client, queryEmbedding: number[], itemIds: string[]): Promise<RetrievedChunk[]> {
  const { data: chunks } = await supabase.from("item_chunks").select("id, item_id, content, metadata, embedding").in("item_id", itemIds).not("embedding", "is", null);
  const rows = chunks ?? [];
  if (rows.length === 0) return [];

  const { data: items } = await supabase
    .from("items")
    .select("id, title")
    .in("id", [...new Set(rows.map((row) => row.item_id))])
    .is("deleted_at", null);
  const titleById = new Map((items ?? []).map((item) => [item.id, item.title]));

  return rows
    .filter((row) => titleById.has(row.item_id))
    .map((row) => ({
      chunkId: row.id,
      itemId: row.item_id,
      title: titleById.get(row.item_id)!,
      content: row.content,
      metadata: row.metadata,
      score: cosineSimilarity(queryEmbedding, row.embedding as unknown as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, RETRIEVE_CHUNK_LIMIT);
}

/** Rótulos (tipo/espaço) dos itens citados no contexto (`buildAskContext`) — `hybrid_search` não devolve isso, então busca à parte, em lote. */
export async function fetchItemLabels(supabase: Client, itemIds: string[]): Promise<Map<string, ItemLabel>> {
  if (itemIds.length === 0) return new Map();

  const { data } = await supabase
    .from("items")
    .select("id, title, object_types(name), spaces(name)")
    .in("id", itemIds)
    .is("deleted_at", null);

  const map = new Map<string, ItemLabel>();
  for (const row of data ?? []) {
    map.set(row.id, { title: row.title, typeName: row.object_types?.name ?? null, spaceName: row.spaces?.name ?? null });
  }
  return map;
}
