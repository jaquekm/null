import "server-only";
import type { JSONContent } from "@tiptap/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { FieldDefinition } from "@/features/types/schemas";
import { computeRollupsForRows } from "@/features/types/lib/rollup-query";
import { listTagsByItemIds, type TagOption } from "@/features/tags/queries";
import { DEFAULT_PAGE_SIZE, parseViewConfig, type ViewFilter, type ViewKind, type ViewSort } from "./schemas";
import { resolveFilter } from "./lib/resolve-filter";
import { resolveSort } from "./lib/resolve-sort";

type Client = SupabaseClient<Database>;

/** Campos do tipo (1.15) — colunas da Tabela, agrupamento do Kanban, campos filtráveis. */
export async function getTypeFields(supabase: Client, typeId: string): Promise<FieldDefinition[]> {
  const { data, error } = await supabase.from("object_types").select("fields").eq("id", typeId).maybeSingle();
  if (error || !data) return [];
  return (data.fields as unknown as FieldDefinition[] | null) ?? [];
}

export interface ViewRow {
  id: string;
  name: string;
  kind: ViewKind;
  spaceId: string | null;
  typeId: string | null;
  config: ReturnType<typeof parseViewConfig>;
  isDefault: boolean;
  position: number;
}

/**
 * Visões (1.15) de um contexto: `typeId` nulo lista as visões "de espaço"
 * (todas as tabs de tipo); um `typeId` lista as visões daquele tipo.
 */
export async function listViews(supabase: Client, spaceId: string, typeId: string | null): Promise<ViewRow[]> {
  let query = supabase
    .from("views")
    .select("id, name, kind, space_id, type_id, config, is_default, position")
    .eq("space_id", spaceId)
    .order("position", { ascending: true });
  query = typeId ? query.eq("type_id", typeId) : query.is("type_id", null);

  const { data, error } = await query;
  if (error) throw error;

  return data.map((view) => ({
    id: view.id,
    name: view.name,
    kind: view.kind as ViewKind,
    spaceId: view.space_id,
    typeId: view.type_id,
    config: parseViewConfig(view.config),
    isDefault: view.is_default,
    position: view.position,
  }));
}

export interface ViewItemRow {
  id: string;
  title: string;
  status: string;
  spaceId: string | null;
  typeId: string | null;
  properties: Record<string, unknown>;
  updatedAt: string;
  createdAt: string;
  position: number;
  tags: TagOption[];
  /** Capa (5.4: Galeria) — `cover_path` da coluna, ou `null` (aí quem exibe procura a primeira imagem em `content`). */
  coverPath: string | null;
  content: JSONContent | null;
}

export interface QueryViewItemsParams {
  spaceId?: string | null;
  typeId?: string | null;
  filters: ViewFilter[];
  sort: ViewSort[];
  fields: FieldDefinition[];
  page: number;
  pageSize?: number;
}

export interface QueryViewItemsResult {
  rows: ViewItemRow[];
  total: number;
}

/**
 * Busca paginada com filtro/ordenação no servidor (1.15) — traduz
 * `views.config` via `resolveFilter`/`resolveSort` em comparações do
 * PostgREST. Reaproveitada pelo Kanban com uma `pageSize` grande (sem
 * paginação real — o enunciado só pede paginação pra Tabela).
 */
export async function queryViewItems(supabase: Client, params: QueryViewItemsParams): Promise<QueryViewItemsResult> {
  const fieldByKey = new Map(params.fields.map((field) => [field.key, field]));
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  let query = supabase
    .from("items")
    .select("id, title, status, space_id, type_id, properties, updated_at, created_at, position, cover_path, content", { count: "exact" })
    .is("deleted_at", null);

  if (params.spaceId) query = query.eq("space_id", params.spaceId);
  if (params.typeId) query = query.eq("type_id", params.typeId);

  for (const filter of params.filters) {
    for (const resolved of resolveFilter(filter, fieldByKey.get(filter.field))) {
      query = resolved.negate
        ? query.not(resolved.column, resolved.op, resolved.value)
        : query.filter(resolved.column, resolved.op, resolved.value);
    }
  }

  if (params.sort.length > 0) {
    for (const sort of params.sort) {
      const resolved = resolveSort(sort, fieldByKey.get(sort.field));
      query = query.order(resolved.column, { ascending: resolved.ascending });
    }
  } else {
    query = query.order("position", { ascending: true }).order("updated_at", { ascending: false });
  }

  const from = (params.page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const tagsByItem = await listTagsByItemIds(
    supabase,
    data.map((item) => item.id),
  );

  const rollupsByItem = await computeRollupsForRows(supabase, data, params.fields);

  return {
    rows: data.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      spaceId: item.space_id,
      typeId: item.type_id,
      properties: { ...((item.properties as Record<string, unknown> | null) ?? {}), ...rollupsByItem.get(item.id) },
      updatedAt: item.updated_at,
      createdAt: item.created_at,
      position: item.position,
      tags: tagsByItem.get(item.id) ?? [],
      coverPath: item.cover_path,
      content: item.content as unknown as JSONContent | null,
    })),
    total: count ?? 0,
  };
}
