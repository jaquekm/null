import type { ViewFilter } from "@/features/views/schemas";

export interface ConditionItem {
  title: string;
  status: string;
  updatedAt?: string;
  createdAt?: string;
  properties: Record<string, unknown>;
}

/**
 * `title`/`status`/`updated_at`/`created_at` são atalhos pras colunas
 * comuns de `items` — mas só quando o item não tem um valor próprio nessa
 * chave em `properties`. Vários tipos de pack definem um campo `status`
 * deles mesmos (Proposta do CRM, Curso/Livro/Plano de Estudos, Tarefa de
 * projeto): sem essa checagem, uma condição `{field:"status",...}` batia
 * silenciosamente contra `items.status` (ciclo de vida active/archived/
 * trashed), nunca contra o valor de verdade do campo — mesmo bug corrigido
 * em `resolveFilterColumn` (views/lib/resolve-filter.ts). `computeRollup`
 * evita isso por outro caminho (nunca passa por `fieldValue`, só por
 * `matchesOperator` direto em `properties`) — este fix cobre os demais
 * usos de `evaluateCondition`/`evaluateConditions` (condições de
 * automação).
 */
function fieldValue(item: ConditionItem, field: string): unknown {
  if (field in item.properties) return item.properties[field];
  switch (field) {
    case "title":
      return item.title;
    case "status":
      return item.status;
    case "updated_at":
      return item.updatedAt;
    case "created_at":
      return item.createdAt;
    default:
      return item.properties[field];
  }
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

/**
 * Núcleo de comparação de uma condição (`op`/`value`) contra um valor já
 * resolvido — extraído de `evaluateCondition` pra ser reaproveitado por
 * quem não tem um `ConditionItem` completo (ex.: `computeRollup`,
 * `features/types/lib/compute-rollup.ts`, que só tem as `properties` do
 * item relacionado, sem `title`/`status` de nível de item).
 */
export function matchesOperator(value: unknown, condition: Pick<ViewFilter, "op" | "value">): boolean {
  switch (condition.op) {
    case "contains":
      return typeof value === "string" && value.toLowerCase().includes(String(condition.value ?? "").toLowerCase());
    case "eq":
      return Array.isArray(value) ? value.includes(condition.value) : value === condition.value;
    case "neq":
      return Array.isArray(value) ? !value.includes(condition.value) : value !== condition.value;
    case "gt":
      return (typeof value === "number" || typeof value === "string") && typeof condition.value === typeof value && value > (condition.value as typeof value);
    case "lt":
      return (typeof value === "number" || typeof value === "string") && typeof condition.value === typeof value && value < (condition.value as typeof value);
    case "between": {
      if (typeof value !== "number" && typeof value !== "string") return false;
      const [from, to] = Array.isArray(condition.value) ? condition.value : [undefined, undefined];
      if (from !== undefined && from !== null && from !== "" && value < from) return false;
      if (to !== undefined && to !== null && to !== "" && value > to) return false;
      return true;
    }
    case "empty":
      return isEmptyValue(value);
    case "not_empty":
      return !isEmptyValue(value);
    case "any_of":
      return Array.isArray(condition.value) ? condition.value.includes(value) : false;
    default: {
      const exhaustive: never = condition.op;
      throw new Error(`Operador de condição desconhecido: ${String(exhaustive)}`);
    }
  }
}

/**
 * Avalia uma condição de automação (5.3: "mesma estrutura de filtros das
 * visões") contra um item já carregado, em memória — ao contrário de
 * `resolveFilter` (views/lib), que traduz pra uma query Postgrest. Pura e
 * testável sem banco.
 */
export function evaluateCondition(item: ConditionItem, condition: ViewFilter): boolean {
  return matchesOperator(fieldValue(item, condition.field), condition);
}

/** Todas as condições precisam passar (E lógico) — automações não têm "OU" no enunciado. */
export function evaluateConditions(item: ConditionItem, conditions: ViewFilter[]): boolean {
  return conditions.every((condition) => evaluateCondition(item, condition));
}
