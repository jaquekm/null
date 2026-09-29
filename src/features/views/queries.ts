import "server-only";
import type { JSONContent } from "@tiptap/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { FieldDefinition } from "@/features/types/schemas";
import { computeFormulas } from "@/features/types/lib/formula";
import { computeRollupsForRows } from "@/features/types/lib/rollup-query";
import { listTagsByItemIds, type TagOption } from "@/features/tags/queries";
import { DEFAULT_PAGE_SIZE, parseViewConfig, type ViewFilter, type ViewKind, type ViewSort } from "./schemas";
import { resolveFilter } from "./lib/resolve-filter";
import { resolveSort } from "./lib/resolve-sort";
import { isTotalable, summarizeColumns, type ColumnSummary } from "./lib/column-totals";

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

/** Campos `formula` (9.6) calculados na leitura, depois dos `rollup` (a conta pode usar um rollup). */
function withFormulas(fields: FieldDefinition[], properties: Record<string, unknown>): Record<string, unknown> {
  return { ...properties, ...computeFormulas(fields, properties) };
}

export interface QueryViewItemsParams {
  spaceId?: string | null;
  typeId?: string | null;
  filters: ViewFilter[];
  sort: ViewSort[];
  fields: FieldDefinition[];
  page: number;
  pageSize?: number;
  /** Calcular a linha de totais (só a Tabela pede). */
  withTotals?: boolean;
}

export interface QueryViewItemsResult {
  rows: ViewItemRow[];
  total: number;
  /** Tabela (9.6): soma/contagem de cada coluna numérica sobre o filtro inteiro. */
  totals?: Record<string, ColumnSummary>;
  /** `true` quando o filtro passa de `TOTALS_ROW_LIMIT` linhas e os totais cobrem só as primeiras. */
  totalsPartial?: boolean;
}

/** Filtros da visão (1.15) aplicados a uma consulta de `items` — a mesma usada nas linhas e nos totais (9.6). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- o tipo do builder do PostgREST muda com o `select`; aqui só encadeamos filtros.
function applyViewFilters<Q extends { eq: any; neq: any; or: any; not: any; filter: any; is: any }>(query: Q, params: QueryViewItemsParams): Q {
  const fieldByKey = new Map(params.fields.map((field) => [field.key, field]));
  let next = query.is("deleted_at", null) as Q;
  if (params.spaceId) next = next.eq("space_id", params.spaceId);
  if (params.typeId) next = next.eq("type_id", params.typeId);

  // "Arquivar" tem que tirar o item das visões — só aparecem se o próprio filtro pedir pelo status (coluna comum, não um campo `status` do tipo).
  const filtersByLifecycleStatus = params.filters.some((filter) => filter.field === "status" && !fieldByKey.has("status"));
  if (!filtersByLifecycleStatus) next = next.neq("status", "archived");

  for (const filter of params.filters) {
    for (const resolved of resolveFilter(filter, fieldByKey.get(filter.field))) {
      if (resolved.or) {
        next = next.or(resolved.or);
        continue;
      }
      next = resolved.negate ? next.not(resolved.column, resolved.op, resolved.value) : next.filter(resolved.column, resolved.op, resolved.value);
    }
  }
  return next;
}

/** Até quantas linhas entram na linha de totais (9.6) — acima disso, os totais avisam que são parciais. */
export const TOTALS_ROW_LIMIT = 5000;

/**
 * Busca paginada com filtro/ordenação no servidor (1.15) — traduz
 * `views.config` via `resolveFilter`/`resolveSort` em comparações do
 * PostgREST. Reaproveitada pelo Kanban com uma `pageSize` grande (sem
 * paginação real — o enunciado só pede paginação pra Tabela).
 */
export async function queryViewItems(supabase: Client, params: QueryViewItemsParams): Promise<QueryViewItemsResult> {
  const fieldByKey = new Map(params.fields.map((field) => [field.key, field]));
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  let query = applyViewFilters(
    supabase
      .from("items")
      .select("id, title, status, space_id, type_id, properties, updated_at, created_at, position, cover_path, content", { count: "exact" }),
    params,
  );

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

  const rows: ViewItemRow[] = data.map((item) => ({
    id: item.id,
    title: item.title,
    status: item.status,
    spaceId: item.space_id,
    typeId: item.type_id,
    properties: withFormulas(params.fields, { ...((item.properties as Record<string, unknown> | null) ?? {}), ...rollupsByItem.get(item.id) }),
    updatedAt: item.updated_at,
    createdAt: item.created_at,
    position: item.position,
    tags: tagsByItem.get(item.id) ?? [],
    coverPath: item.cover_path,
    content: item.content as unknown as JSONContent | null,
  }));
  const total = count ?? 0;

  if (!params.withTotals || !params.fields.some(isTotalable)) return { rows, total };
  // Cabe tudo nesta página: soma o que já veio. Senão, busca só as propriedades do filtro inteiro.
  if (total <= rows.length) return { rows, total, totals: summarizeColumns(rows.map((row) => row.properties), params.fields), totalsPartial: false };

  const { data: all, error: totalsError } = await applyViewFilters(supabase.from("items").select("id, properties"), params).limit(TOTALS_ROW_LIMIT);
  if (totalsError || !all) return { rows, total };
  const allRollups = params.fields.some((field) => field.type === "rollup") ? await computeRollupsForRows(supabase, all, params.fields) : new Map();
  const allProperties = all.map((item) =>
    withFormulas(params.fields, { ...((item.properties as Record<string, unknown> | null) ?? {}), ...allRollups.get(item.id) }),
  );
  return { rows, total, totals: summarizeColumns(allProperties, params.fields), totalsPartial: total > all.length };
}

/** Até quantas linhas a exportação pra Excel leva (9.6). */
export const EXPORT_ROW_LIMIT = 5000;

/** Linhas da visão pra exportar (9.6): mesmo filtro e ordem da tela, sem paginar e sem o conteúdo (só título e propriedades). */
export async function listViewRowsForExport(
  supabase: Client,
  params: Omit<QueryViewItemsParams, "page" | "pageSize" | "withTotals">,
): Promise<{ rows: { title: string; properties: Record<string, unknown> }[]; truncated: boolean }> {
  const fieldByKey = new Map(params.fields.map((field) => [field.key, field]));
  let query = applyViewFilters(supabase.from("items").select("id, title, properties", { count: "exact" }), { ...params, page: 1 });
  if (params.sort.length > 0) {
    for (const sort of params.sort) {
      const resolved = resolveSort(sort, fieldByKey.get(sort.field));
      query = query.order(resolved.column, { ascending: resolved.ascending });
    }
  } else {
    query = query.order("position", { ascending: true }).order("updated_at", { ascending: false });
  }
  const { data, error, count } = await query.limit(EXPORT_ROW_LIMIT);
  if (error) throw error;
  const rollups = params.fields.some((field) => field.type === "rollup") ? await computeRollupsForRows(supabase, data, params.fields) : new Map();
  return {
    rows: data.map((item) => ({
      title: item.title,
      properties: withFormulas(params.fields, { ...((item.properties as Record<string, unknown> | null) ?? {}), ...rollups.get(item.id) }),
    })),
    truncated: (count ?? 0) > data.length,
  };
}
