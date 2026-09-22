import { z } from "zod";

export const filterOperators = ["contains", "eq", "neq", "gt", "lt", "between", "empty", "not_empty", "any_of"] as const;
export type FilterOperator = (typeof filterOperators)[number];

export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: "contém",
  eq: "=",
  neq: "≠",
  gt: ">",
  lt: "<",
  between: "entre",
  empty: "vazio",
  not_empty: "não vazio",
  any_of: "é qualquer um de",
};

export const viewFilterSchema = z.object({
  field: z.string(),
  op: z.enum(filterOperators),
  value: z.unknown().optional(),
});
export type ViewFilter = z.infer<typeof viewFilterSchema>;

export const viewSortSchema = z.object({
  field: z.string(),
  dir: z.enum(["asc", "desc"]),
});
export type ViewSort = z.infer<typeof viewSortSchema>;

/**
 * `views.config` (1.15, estendido na 5.4) — filtros, ordenação, agrupamento
 * (kanban/linha do tempo), colunas visíveis e paginação, mais a
 * configuração específica das visões novas: `dateField` (Calendário — um
 * campo `date`/`datetime`), `startField`/`endField` (Linha do tempo — barras
 * entre dois campos de data) e `dependsOnField` (Linha do tempo, opcional —
 * um campo `relation` "depende de", pra desenhar as setas de dependência).
 */
export const viewConfigSchema = z.object({
  filters: z.array(viewFilterSchema).default([]),
  sort: z.array(viewSortSchema).default([]),
  groupBy: z.string().optional(),
  visibleFields: z.array(z.string()).optional(),
  pageSize: z.number().int().positive().max(200).optional(),
  dateField: z.string().optional(),
  startField: z.string().optional(),
  endField: z.string().optional(),
  dependsOnField: z.string().optional(),
  /** Kanban (5.6, "soma de valores por coluna"): campo `money` cujo total (por coluna) aparece no cabeçalho — genérico, qualquer tipo com campo `money` pode usar. */
  sumField: z.string().optional(),
});
export type ViewConfig = z.infer<typeof viewConfigSchema>;

export const DEFAULT_PAGE_SIZE = 25;

export function parseViewConfig(raw: unknown): ViewConfig {
  const parsed = viewConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : { filters: [], sort: [] };
}

/** Mesma lista de `features/types/object-type-schemas.ts` (já usada por `object_types.default_view` e pelos packs) — aqui é onde as visões passam a existir de verdade (5.4). */
export const viewKinds = ["list", "table", "kanban", "calendar", "timeline", "gallery"] as const;
export type ViewKind = (typeof viewKinds)[number];
