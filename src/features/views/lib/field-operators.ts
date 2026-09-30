import type { FieldType } from "@/features/types/schemas";
import type { FilterOperator } from "../schemas";

/** Quais operadores fazem sentido pra cada tipo de campo (1.15). */
export function operatorsForFieldType(type: FieldType): FilterOperator[] {
  switch (type) {
    case "text":
    case "long_text":
    case "phone":
    case "url":
    case "email":
      return ["contains", "eq", "neq", "empty", "not_empty"];
    case "number":
    case "percent":
    case "rating":
    case "money":
    case "duration":
    case "date":
    case "datetime":
      return ["eq", "neq", "gt", "lt", "between", "empty", "not_empty"];
    case "select":
      return ["eq", "neq", "any_of", "empty", "not_empty"];
    case "multi_select":
      return ["any_of", "empty", "not_empty"];
    case "checkbox":
      return ["eq"];
    case "relation":
    case "contact":
    case "file":
      return ["any_of", "empty", "not_empty"];
    case "rollup":
    case "formula":
      // Computado em runtime, não é uma coluna de banco — não dá pra filtrar/ordenar no servidor (5.8).
      return [];
    default: {
      const exhaustive: never = type;
      throw new Error(`Tipo de campo desconhecido: ${String(exhaustive)}`);
    }
  }
}

/** Colunas comuns de `items` que também podem ser filtradas/ordenadas (fora de `properties`). */
export const COMMON_FIELD_KEYS = ["title", "status", "updated_at", "created_at"] as const;
export type CommonFieldKey = (typeof COMMON_FIELD_KEYS)[number];

export function isCommonField(key: string): key is CommonFieldKey {
  return (COMMON_FIELD_KEYS as readonly string[]).includes(key);
}

/**
 * Operadores válidos pro campo de um filtro. Um campo próprio do tipo vence a
 * coluna comum de mesmo nome (mesma regra de `resolveFilterColumn`: vários
 * packs definem um `status` próprio).
 */
export function operatorsForFilterField(key: string, fieldDef?: { type: FieldType }): FilterOperator[] {
  if (fieldDef) return operatorsForFieldType(fieldDef.type);
  return isCommonField(key) ? operatorsForCommonField(key) : [];
}

/**
 * Operador inicial ao adicionar um filtro ou trocar o campo. Fixar "contém"
 * pra qualquer campo mandava `ilike` pra colunas de data (`created_at`) — erro
 * no Postgres, e a página inteira caía em "Algo deu errado".
 */
export function defaultOperatorFor(key: string, fieldDef?: { type: FieldType }): FilterOperator {
  return operatorsForFilterField(key, fieldDef)[0] ?? "eq";
}

export function operatorsForCommonField(key: CommonFieldKey): FilterOperator[] {
  switch (key) {
    case "title":
      return ["contains", "eq", "neq", "empty", "not_empty"];
    case "status":
      return ["eq", "neq", "any_of"];
    case "updated_at":
    case "created_at":
      return ["gt", "lt", "between"];
    default: {
      const exhaustive: never = key;
      throw new Error(`Campo comum desconhecido: ${String(exhaustive)}`);
    }
  }
}
