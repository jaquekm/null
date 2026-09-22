import { matchesOperator } from "@/features/automations/lib/evaluate-conditions";
import type { ViewFilter } from "@/features/views/schemas";
import type { RollupOp } from "../schemas";

export interface RollupRelatedItem {
  properties: Record<string, unknown>;
}

export interface RollupCalcConfig {
  op: RollupOp;
  /** Obrigatório pra `sum` — chave numérica do item relacionado a somar. */
  targetField?: string;
  /**
   * Filtra os itens relacionados antes de agregar. Sempre lido de
   * `properties[condition.field]` — ao contrário de `evaluateCondition`
   * (automações), nunca de colunas de nível de item (`title`/`status`
   * genérico): um campo de tipo chamado `status` (comum — o tipo Tarefa do
   * onboarding tem um campo `status`) coincidiria com a coluna
   * `items.status` se reaproveitássemos aquele resolvedor aqui.
   */
  condition?: Pick<ViewFilter, "field" | "op" | "value">;
}

/**
 * Agregação de um campo `rollup` (5.8: "campos calculados... rollup: contar
 * /somar/porcentagem de itens relacionados que atendem condição") sobre os
 * itens relacionados já carregados — pura, sem acesso a banco (quem busca os
 * itens é `rollup-query.ts`, que roda no servidor).
 */
export function computeRollup(relatedItems: RollupRelatedItem[], config: RollupCalcConfig): number {
  const matching = config.condition
    ? relatedItems.filter((item) => matchesOperator(item.properties[config.condition!.field], config.condition!))
    : relatedItems;

  switch (config.op) {
    case "count":
      return matching.length;
    case "sum":
      if (!config.targetField) return 0;
      return matching.reduce((total, item) => {
        const value = item.properties[config.targetField!];
        return total + (typeof value === "number" ? value : 0);
      }, 0);
    case "percent":
      if (relatedItems.length === 0) return 0;
      return Math.round((matching.length / relatedItems.length) * 100);
    default: {
      const exhaustive: never = config.op;
      throw new Error(`Operação de rollup desconhecida: ${String(exhaustive)}`);
    }
  }
}
