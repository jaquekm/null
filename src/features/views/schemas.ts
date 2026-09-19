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

/** `views.config` (1.15) — filtros, ordenação, agrupamento (kanban), colunas visíveis e paginação. */
export const viewConfigSchema = z.object({
  filters: z.array(viewFilterSchema).default([]),
  sort: z.array(viewSortSchema).default([]),
  groupBy: z.string().optional(),
  visibleFields: z.array(z.string()).optional(),
  pageSize: z.number().int().positive().max(200).optional(),
});
export type ViewConfig = z.infer<typeof viewConfigSchema>;

export const DEFAULT_PAGE_SIZE = 25;

export function parseViewConfig(raw: unknown): ViewConfig {
  const parsed = viewConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : { filters: [], sort: [] };
}

export const viewKinds = ["list", "table", "kanban"] as const;
export type ViewKind = (typeof viewKinds)[number];
