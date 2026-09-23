import "server-only";
import { estimateTokens } from "@/features/ai/lib/chunking";
import { averageEmbedding } from "@/features/ai/lib/embeddings-math";
import { estimateEmbeddingCostUsd } from "@/lib/ai/pricing";
import { getEmbeddingsProvider } from "@/lib/embeddings";
import type { Client } from "./types";

export interface ReindexEstimate {
  itemCount: number;
  estimatedTokens: number;
  estimatedUsd: number | null;
}

/**
 * Estimativa pra "Reindexar tudo" (6.5, `/configuracoes/ia`) — soma bruta do
 * texto indexável de todo item ativo (`content_text`/`extra_text`/`properties`),
 * sem montar os trechos de verdade (isso já é o trabalho do próprio job,
 * caro demais pra rodar só pra estimar). Superestima um pouco (o chunking
 * real tem sobreposição entre trechos), o que é o lado seguro pra uma
 * estimativa de custo.
 */
export async function estimateReindexCost(supabase: Client, ownerId: string): Promise<ReindexEstimate> {
  const { data } = await supabase.from("items").select("id, content_text, extra_text, properties").eq("owner_id", ownerId).is("deleted_at", null);
  const rows = data ?? [];

  const totalChars = rows.reduce((sum, row) => {
    const propertiesText = JSON.stringify(row.properties ?? {});
    return sum + row.content_text.length + row.extra_text.length + propertiesText.length;
  }, 0);

  const estimatedTokens = estimateTokens("a".repeat(totalChars));
  const provider = getEmbeddingsProvider();
  const estimatedUsd = provider ? estimateEmbeddingCostUsd(provider.model, estimatedTokens) : null;

  return { itemCount: rows.length, estimatedTokens, estimatedUsd };
}

/** Ids de todo item ativo do dono — "Reindexar tudo" enfileira `index_item` pra cada um. */
export async function listActiveItemIds(supabase: Client, ownerId: string): Promise<string[]> {
  const { data } = await supabase.from("items").select("id").eq("owner_id", ownerId).is("deleted_at", null);
  return (data ?? []).map((row) => row.id);
}

export interface RelatedItemRow {
  id: string;
  title: string;
}

const RELATED_ITEMS_LIMIT = 5;

/**
 * "Itens relacionados" (6.6, painel do item): embedding do item = média dos
 * embeddings dos trechos dele (`averageEmbedding` — com um trecho só, a
 * "média" é o próprio trecho, cobrindo o "ou do primeiro trecho" do
 * enunciado sem precisar de um caminho especial) → vizinhos mais próximos
 * (`related_items`, RPC nova da 6.6 — `hybrid_search` não serve, exige um
 * texto de consulta) → exclui itens já ligados (qualquer direção — este
 * item como origem ou como alvo de um `link`). Pede alguns candidatos a
 * mais que o limite final (`RELATED_ITEMS_LIMIT + já ligados`) pra sobrar
 * `RELATED_ITEMS_LIMIT` depois do filtro.
 */
export async function listRelatedItems(supabase: Client, itemId: string): Promise<RelatedItemRow[]> {
  const { data: chunks } = await supabase.from("item_chunks").select("embedding").eq("item_id", itemId).not("embedding", "is", null);
  const embedding = averageEmbedding((chunks ?? []).map((row) => row.embedding as unknown as number[]));
  if (!embedding) return [];

  const { data: links } = await supabase.from("links").select("source_id, target_id").or(`source_id.eq.${itemId},target_id.eq.${itemId}`);
  const linkedIds = new Set((links ?? []).map((link) => (link.source_id === itemId ? link.target_id : link.source_id)));

  const { data: candidates, error } = await supabase.rpc("related_items", {
    p_item_id: itemId,
    p_embedding: embedding as unknown as string,
    p_limit: RELATED_ITEMS_LIMIT + linkedIds.size,
  });
  if (error || !candidates) return [];

  return candidates
    .filter((row) => !linkedIds.has(row.item_id))
    .slice(0, RELATED_ITEMS_LIMIT)
    .map((row) => ({ id: row.item_id, title: row.title }));
}

/**
 * "Criar link" a partir de "Talvez relacionado" (6.6) — `kind: "related"`,
 * novo (a coluna não tem `check` travando valores, ver migration da
 * fundação). Checa duplicidade antes de inserir: o índice único de `links`
 * inclui `field_key`, que fica `null` pra esse `kind` — e Postgres trata
 * `null <> null` como não-igual em índice único, então duas chamadas
 * inseririam duas linhas em vez de colidir (diferente de `mention`/`relation`,
 * que sempre têm `field_key` preenchido).
 */
export async function createRelatedLink(supabase: Client, ownerId: string, sourceId: string, targetId: string): Promise<void> {
  const { data: existing } = await supabase.from("links").select("id").eq("source_id", sourceId).eq("target_id", targetId).eq("kind", "related").maybeSingle();
  if (existing) return;

  const { error } = await supabase.from("links").insert({ owner_id: ownerId, source_id: sourceId, target_id: targetId, kind: "related" });
  if (error) throw error;
}
