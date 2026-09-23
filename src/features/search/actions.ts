"use server";

import { getEmbeddingsProvider } from "@/lib/embeddings";
import { requireOwner } from "@/lib/auth";
import { extractSeekSeconds, groupHybridResultsByItem } from "./lib/group-hybrid-results";

export interface SearchFilters {
  spaceId?: string | null;
  typeId?: string | null;
  tagId?: string | null;
  status?: string | null;
  updatedAfter?: string | null;
  updatedBefore?: string | null;
}

export interface SearchResultRow {
  id: string;
  title: string;
  snippet: string;
  spaceId: string | null;
  typeId: string | null;
  status: string;
  updatedAt: string;
}

/**
 * Busca (1.14): chama a RPC `search_items` (1.1, com filtro de tag/período
 * acrescentado nesta tarefa). `q` pode vir vazio quando a busca é só por
 * `#tag` — nesse caso a função lista pelos outros filtros, sem exigir match
 * de texto nenhum (ver a migration `busca_filtros`).
 */
export async function searchItems(q: string, filters: SearchFilters = {}): Promise<SearchResultRow[]> {
  const { supabase } = await requireOwner();

  const { data, error } = await supabase.rpc("search_items", {
    q,
    p_space_id: filters.spaceId ?? undefined,
    p_type_id: filters.typeId ?? undefined,
    p_tag_id: filters.tagId ?? undefined,
    p_status: filters.status ?? undefined,
    p_updated_after: filters.updatedAfter ?? undefined,
    p_updated_before: filters.updatedBefore ?? undefined,
    p_limit: 30,
  });
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    snippet: row.snippet,
    spaceId: row.space_id,
    typeId: row.type_id,
    status: row.status,
    updatedAt: row.updated_at,
  }));
}

export interface HybridSearchResultRow {
  id: string;
  title: string;
  snippet: string;
  spaceId: string | null;
  typeId: string | null;
  status: string;
  updatedAt: string;
  /** Segundos onde a transcrição correspondente começa — só quando o trecho mais relevante é de uma transcrição (6.6, "Ouvir a partir de..."). */
  seekSeconds: number | null;
}

const HYBRID_CHUNK_LIMIT = 40;
const HYBRID_ITEM_LIMIT = 20;

/**
 * Busca "por significado" (6.6): `embedQuery` → RPC `hybrid_search` (6.1,
 * já combina texto + vetor) → agrupa os trechos por item, mantendo só o de
 * maior score (`hybrid_search` já devolve ordenado por score desc, então o
 * primeiro trecho de cada item já é o melhor dele — sem precisar reordenar
 * depois de agrupar). Sem provedor de embeddings configurado (ou a chamada
 * falhando), cai pra `searchItems` (busca textual) — nunca quebra a busca
 * por causa de um provedor externo fora do ar.
 *
 * `hybrid_search` só filtra por espaço/tipo (sem tag/status/período) — quem
 * chama (`SearchWorkspace`) esconde esses filtros no modo "por significado".
 */
function withoutSeek(rows: SearchResultRow[]): HybridSearchResultRow[] {
  return rows.map((row) => ({ ...row, seekSeconds: null }));
}

export async function hybridSearchItems(q: string, filters: Pick<SearchFilters, "spaceId" | "typeId"> = {}): Promise<HybridSearchResultRow[]> {
  const { supabase } = await requireOwner();
  if (!q.trim()) return [];

  const provider = getEmbeddingsProvider();
  if (!provider) return withoutSeek(await searchItems(q, filters));

  let queryEmbedding: number[];
  try {
    queryEmbedding = await provider.embedQuery(q);
  } catch {
    return withoutSeek(await searchItems(q, filters));
  }

  const { data, error } = await supabase.rpc("hybrid_search", {
    q,
    q_embedding: queryEmbedding as unknown as string,
    p_space_ids: filters.spaceId ? [filters.spaceId] : undefined,
    p_type_ids: filters.typeId ? [filters.typeId] : undefined,
    p_limit: HYBRID_CHUNK_LIMIT,
  });
  if (error || !data) return [];

  const grouped = groupHybridResultsByItem(data, HYBRID_ITEM_LIMIT);
  if (grouped.length === 0) return [];

  const itemIds = grouped.map((row) => row.itemId);
  const { data: items } = await supabase
    .from("items")
    .select("id, space_id, type_id, status, updated_at")
    .in("id", itemIds)
    .is("deleted_at", null);
  const itemById = new Map((items ?? []).map((row) => [row.id, row]));

  const results: HybridSearchResultRow[] = [];
  for (const chunk of grouped) {
    const item = itemById.get(chunk.itemId);
    if (!item) continue;

    results.push({
      id: chunk.itemId,
      title: chunk.title,
      snippet: chunk.content.length > 280 ? `${chunk.content.slice(0, 280)}…` : chunk.content,
      spaceId: item.space_id,
      typeId: item.type_id,
      status: item.status,
      updatedAt: item.updated_at,
      seekSeconds: extractSeekSeconds(chunk.metadata),
    });
  }

  return results;
}
