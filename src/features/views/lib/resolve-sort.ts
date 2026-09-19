import type { FieldDefinition } from "@/features/types/schemas";
import type { ViewSort } from "../schemas";
import { resolveFilterColumn } from "./resolve-filter";

export interface ResolvedSort {
  column: string;
  ascending: boolean;
}

/** Mesma resolução de coluna/cast do filtro (1.15) — reaproveitada pra ordenar. */
export function resolveSort(sort: ViewSort, fieldDef?: FieldDefinition): ResolvedSort {
  return { column: resolveFilterColumn(sort.field, fieldDef), ascending: sort.dir === "asc" };
}
