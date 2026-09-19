"use server";

import { requireOwner } from "@/lib/auth";

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
