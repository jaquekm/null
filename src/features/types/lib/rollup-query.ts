import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ViewFilter } from "@/features/views/schemas";
import type { Database } from "@/lib/supabase/database.types";
import type { FieldDefinition } from "../schemas";
import { computeRollup, type RollupRelatedItem } from "./compute-rollup";

type Client = SupabaseClient<Database>;

/**
 * Calcula os campos `rollup` (5.8) de um lote de itens do mesmo tipo, de uma
 * vez só: pra cada campo `rollup`, busca todos os itens do
 * `rollupRelationTypeId` (RLS já restringe ao dono — uso pessoal, sem
 * paginação) e agrupa em memória por `rollupRelationField`, em vez de uma
 * query por linha. Retorna um mapa `itemId -> { [rollupFieldKey]: valor }`
 * pra ser mesclado em `properties` por quem lê (nunca é gravado no banco).
 */
export async function computeRollupsForRows(
  supabase: Client,
  rows: { id: string }[],
  fields: FieldDefinition[],
): Promise<Map<string, Record<string, number>>> {
  const result = new Map<string, Record<string, number>>(rows.map((row) => [row.id, {}]));
  const rollupFields = fields.filter((field) => field.type === "rollup" && field.rollupRelationTypeId && field.rollupRelationField && field.rollupOp);
  if (rollupFields.length === 0 || rows.length === 0) return result;

  for (const field of rollupFields) {
    const relationTypeId = field.rollupRelationTypeId!;
    const relationField = field.rollupRelationField!;

    const { data } = await supabase.from("items").select("properties").eq("type_id", relationTypeId).is("deleted_at", null);

    const byParent = new Map<string, RollupRelatedItem[]>();
    for (const related of data ?? []) {
      const properties = (related.properties as Record<string, unknown> | null) ?? {};
      const parentIds = properties[relationField];
      if (!Array.isArray(parentIds)) continue;
      const relatedItem: RollupRelatedItem = { properties };
      for (const parentId of parentIds) {
        if (typeof parentId !== "string") continue;
        const bucket = byParent.get(parentId);
        if (bucket) bucket.push(relatedItem);
        else byParent.set(parentId, [relatedItem]);
      }
    }

    for (const row of rows) {
      const value = computeRollup(byParent.get(row.id) ?? [], {
        op: field.rollupOp!,
        targetField: field.rollupTargetField,
        // `op` é validado como `string` livre no schema do tipo (evita ciclo de import com
        // `features/views/schemas`) — `matchesOperator` é quem valida o operador de verdade.
        condition: field.rollupCondition as Pick<ViewFilter, "field" | "op" | "value"> | undefined,
      });
      result.get(row.id)![field.key] = value;
    }
  }

  return result;
}
