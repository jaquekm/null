import { randomUUID } from "node:crypto";
import { uniqueFieldKey } from "@/features/types/lib/field-key";
import type { FieldDefinition, SelectOption } from "@/features/types/schemas";

export interface ResolvedSelectField {
  fields: FieldDefinition[];
  fieldKey: string;
  optionIdByLabel: Map<string, string>;
}

const normalize = (label: string) => label.trim().toLowerCase();

/**
 * Origem "Planilha" (7.5+): garante que o tipo de destino tenha um campo
 * `select` com este rótulo (cria se não existir) e que cada valor bruto de
 * `labels` (as strings da coluna categoria/subcategoria) tenha uma opção
 * correspondente — casando por rótulo, sem diferenciar maiúscula/minúscula
 * ou espaços nas pontas, criando a opção que faltar. `commitImport` grava o
 * `fields` devolvido de volta em `object_types` uma única vez.
 */
export function ensureSelectFieldWithOptions(fields: FieldDefinition[], fieldLabel: string, labels: string[]): ResolvedSelectField {
  const uniqueLabels = [...new Set(labels.map((label) => label.trim()).filter(Boolean))];

  let nextFields = fields;
  let field = nextFields.find((f) => f.type === "select" && normalize(f.label) === normalize(fieldLabel));

  if (!field) {
    field = {
      key: uniqueFieldKey(
        fieldLabel,
        nextFields.map((f) => f.key),
      ),
      label: fieldLabel,
      type: "select",
      required: false,
      options: [],
    };
    nextFields = [...nextFields, field];
  }

  const options: SelectOption[] = [...(field.options ?? [])];
  const optionIdByLabel = new Map<string, string>();
  for (const option of options) optionIdByLabel.set(normalize(option.label), option.id);

  for (const label of uniqueLabels) {
    const key = normalize(label);
    if (optionIdByLabel.has(key)) continue;
    const newOption: SelectOption = { id: randomUUID(), label };
    options.push(newOption);
    optionIdByLabel.set(key, newOption.id);
  }

  const resolvedField: FieldDefinition = { ...field, options };
  nextFields = nextFields.map((f) => (f.key === resolvedField.key ? resolvedField : f));

  return { fields: nextFields, fieldKey: resolvedField.key, optionIdByLabel };
}
