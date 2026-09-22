import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { viewFilterSchema } from "@/features/views/schemas";
import { evaluateConditions, type ConditionItem } from "./evaluate-conditions";
import { executeAction, type AutomationItemContext } from "./execute-action";
import { automationActionSchema } from "../schemas";

type Client = SupabaseClient<Database>;
type AutomationRow = Tables<"automations">;

const conditionsArraySchema = z.array(viewFilterSchema);
const actionsArraySchema = z.array(automationActionSchema);

export interface RunActionsOutcome {
  conditionsPassed: boolean;
  failed: boolean;
  error?: string;
  actionResults: Record<string, unknown>[];
}

/**
 * Avalia condições e roda as ações de uma automação já sabida elegível
 * (gatilho/escopo bateram, proteção contra laço já checada) contra um item
 * — compartilhado pelos dois disparadores do motor (5.3): o job orientado a
 * evento (`run-automations.ts`) e o periódico (`evaluate-time-automations.ts`).
 * Para na primeira ação que falhar, na ordem declarada.
 */
export async function runActionsForItem(
  supabase: Client,
  ownerId: string,
  automation: AutomationRow,
  item: AutomationItemContext | null,
  chainId: string,
  depth: number,
): Promise<RunActionsOutcome> {
  // `conditions`/`actions` podem ter sido gravadas por um pack (5.2), que não valida contra estes
  // schemas na instalação (ver decisoes.md) — checa aqui em vez de confiar cegamente no JSON do banco.
  const conditionsParsed = conditionsArraySchema.safeParse(automation.conditions ?? []);
  const actionsParsed = actionsArraySchema.safeParse(automation.actions);
  if (!conditionsParsed.success || !actionsParsed.success) {
    return { conditionsPassed: true, failed: true, error: "Gatilho, condições ou ações desta automação estão em um formato inválido.", actionResults: [] };
  }

  // Sem item (automação de `schedule` sem item associado), não há o que checar — condições passam por vazio.
  const conditionItem: ConditionItem | null = item ? { title: item.title, status: item.status, properties: item.properties } : null;
  if (conditionItem && !evaluateConditions(conditionItem, conditionsParsed.data)) {
    return { conditionsPassed: false, failed: false, actionResults: [] };
  }

  const actions = actionsParsed.data;
  const actionResults: Record<string, unknown>[] = [];
  let error: string | undefined;

  for (const action of actions) {
    const outcome = await executeAction(action, { supabase, ownerId, automationId: automation.id, item, chainId, depth });
    actionResults.push({ type: action.type, ...outcome });
    if (!outcome.ok) {
      error = outcome.error;
      break;
    }
  }

  return { conditionsPassed: true, failed: Boolean(error), error, actionResults };
}
