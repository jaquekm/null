import type { FieldDefinition } from "@/features/types/schemas";
import type { ViewFilter } from "../schemas";
import { isCommonField } from "./field-operators";

const NUMERIC_TYPES = new Set<FieldDefinition["type"]>(["number", "percent", "rating", "money", "duration"]);

export interface ResolvedFilter {
  column: string;
  op: "ilike" | "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "is";
  value: unknown;
  /** Quando true, a comparação vira uma negação (`.not(column, op, value)`). */
  negate?: boolean;
}

/**
 * Coluna Postgres/PostgREST pra um campo do filtro (1.15): campos comuns
 * (`title`, `status`...) são colunas de verdade; os demais vêm de
 * `properties` (jsonb) — campos numéricos ganham um cast pra comparar por
 * valor, não por texto (`"9" < "10"` na comparação de texto, o que é errado
 * pra número). Datas (`date`/`datetime`) são strings ISO de largura fixa,
 * então comparam certo como texto, sem precisar de cast.
 */
export function resolveFilterColumn(field: string, fieldDef?: FieldDefinition): string {
  if (isCommonField(field)) return field;
  const cast = fieldDef && NUMERIC_TYPES.has(fieldDef.type) ? "::numeric" : "";
  return `properties->>${field}${cast}`;
}

/**
 * Traduz um filtro de `views.config` (1.15) pra uma lista de comparações
 * `{column, op, value}` — função pura, sem tocar no Supabase, pra poder
 * testar sem banco. `between` pode virar duas comparações (`gte`+`lte`).
 */
export function resolveFilter(filter: ViewFilter, fieldDef?: FieldDefinition): ResolvedFilter[] {
  const column = resolveFilterColumn(filter.field, fieldDef);

  switch (filter.op) {
    case "contains":
      return [{ column, op: "ilike", value: `%${String(filter.value ?? "")}%` }];
    case "eq":
      return [{ column, op: "eq", value: filter.value }];
    case "neq":
      return [{ column, op: "neq", value: filter.value }];
    case "gt":
      return [{ column, op: "gt", value: filter.value }];
    case "lt":
      return [{ column, op: "lt", value: filter.value }];
    case "between": {
      const [from, to] = Array.isArray(filter.value) ? filter.value : [undefined, undefined];
      const result: ResolvedFilter[] = [];
      if (from !== undefined && from !== null && from !== "") result.push({ column, op: "gte", value: from });
      if (to !== undefined && to !== null && to !== "") result.push({ column, op: "lte", value: to });
      return result;
    }
    case "empty":
      return [{ column, op: "is", value: null }];
    case "not_empty":
      return [{ column, op: "is", value: null, negate: true }];
    case "any_of":
      return [{ column, op: "in", value: Array.isArray(filter.value) ? filter.value : [] }];
    default: {
      const exhaustive: never = filter.op;
      throw new Error(`Operador de filtro desconhecido: ${String(exhaustive)}`);
    }
  }
}
