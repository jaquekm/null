import { z } from "zod";

export const fieldTypes = [
  "text",
  "long_text",
  "number",
  "money",
  "percent",
  "date",
  "datetime",
  "select",
  "multi_select",
  "checkbox",
  "url",
  "email",
  "phone",
  "rating",
  "relation",
  "contact",
  "file",
  "duration",
  "rollup",
] as const;

export type FieldType = (typeof fieldTypes)[number];

/** Agregações suportadas por um campo `rollup` (5.8: "campos calculados... rollup: contar/somar/porcentagem"). */
export const rollupOps = ["count", "sum", "percent"] as const;
export type RollupOp = (typeof rollupOps)[number];

/**
 * Mesma forma de `ViewFilter` (`features/views/schemas.ts`), duplicada aqui
 * de propósito: `features/views` já importa deste arquivo, então importar
 * `ViewFilter` de volta criaria um ciclo. `op` fica livre (`string`) — quem
 * avalia de verdade (`evaluateCondition`, `features/automations/lib`) valida
 * o operador.
 */
const rollupConditionSchema = z.object({
  field: z.string().min(1),
  op: z.string().min(1),
  value: z.unknown().optional(),
});

export const selectOptionSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  color: z.string().optional(),
});

export type SelectOption = z.infer<typeof selectOptionSchema>;

export const fieldDefinitionSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  type: z.enum(fieldTypes),
  required: z.boolean().default(false),
  description: z.string().optional(),
  options: z.array(selectOptionSchema).optional(),
  relationTypeId: z.string().uuid().optional(),
  multiple: z.boolean().optional(),
  currency: z.string().default("BRL").optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  hidden: z.boolean().optional(),
  showInCard: z.boolean().optional(),
  /**
   * Config de um campo `rollup` (5.8) — nunca armazenado em
   * `items.properties`, sempre computado em runtime a partir dos itens de
   * `rollupRelationTypeId` cujo campo `rollupRelationField` contém o id
   * deste item (`features/types/lib/rollup-query.ts`).
   */
  rollupRelationTypeId: z.string().uuid().optional(),
  rollupRelationField: z.string().min(1).optional(),
  rollupOp: z.enum(rollupOps).optional(),
  rollupTargetField: z.string().min(1).optional(),
  rollupCondition: rollupConditionSchema.optional(),
});

export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;

function applyRange(schema: z.ZodNumber, field: FieldDefinition): z.ZodNumber {
  let ranged = schema;
  if (field.min !== undefined) ranged = ranged.min(field.min);
  if (field.max !== undefined) ranged = ranged.max(field.max);
  return ranged;
}

function selectValueSchema(field: FieldDefinition): z.ZodTypeAny {
  const ids = field.options?.map((option) => option.id) ?? [];
  if (ids.length === 0) return z.string().min(1);
  return z.enum(ids as [string, ...string[]]);
}

function relationArraySchema(field: FieldDefinition): z.ZodTypeAny {
  const items = z.array(z.string().uuid());
  return field.multiple === false ? items.max(1) : items;
}

/**
 * Um valor por chave de `items.properties`, de acordo com a tabela de
 * "Regras de armazenamento" da tarefa 1.2 (docs/fase-01-nucleo.md).
 */
function fieldValueSchema(field: FieldDefinition): z.ZodTypeAny {
  switch (field.type) {
    case "text":
    case "long_text":
    case "phone":
      return z.string();
    case "url":
      return z.string().url();
    case "email":
      return z.string().email();
    case "number":
    case "percent":
      return applyRange(z.number(), field);
    case "rating":
      return applyRange(z.number().int(), field);
    case "money":
      return z.number().int();
    case "duration":
      return z.number().int().nonnegative();
    case "date":
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD");
    case "datetime":
      return z.string().datetime();
    case "checkbox":
      return z.boolean();
    case "select":
      return selectValueSchema(field);
    case "multi_select":
      return z.array(selectValueSchema(field));
    case "relation":
    case "contact":
    case "file":
      return relationArraySchema(field);
    case "rollup":
      // Nunca chega a ser chamado: `buildPropertiesSchema` pula campos
      // `rollup` antes de invocar `fieldValueSchema` (não são armazenados).
      return z.never();
    default: {
      const exhaustive: never = field.type;
      throw new Error(`Tipo de campo desconhecido: ${String(exhaustive)}`);
    }
  }
}

/**
 * Monta dinamicamente o schema Zod de `items.properties` para um tipo de
 * objeto. Chaves fora de `fields` são preservadas (`.passthrough()`) mas não
 * validadas — evita perder dados salvos quando um campo é removido do tipo.
 * Campos `rollup` (5.8) nunca entram no shape: são computados em runtime,
 * nunca gravados em `items.properties`.
 */
export function buildPropertiesSchema(fields: FieldDefinition[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    if (field.type === "rollup") continue;
    const valueSchema = fieldValueSchema(field);
    shape[field.key] = field.required ? valueSchema : valueSchema.optional();
  }
  return z.object(shape).passthrough();
}
