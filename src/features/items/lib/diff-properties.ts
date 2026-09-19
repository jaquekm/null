import type { FieldDefinition } from "@/features/types/schemas";
import { formatPropertyValue } from "@/features/views/lib/format-property-value";

export interface PropertyDiffEntry {
  key: string;
  label: string;
  oldValue: string;
  newValue: string;
}

/** Campos cujo valor formatado mudou entre duas versões de `properties` — usado pra comparar versões (1.17). */
export function diffProperties(
  oldProperties: Record<string, unknown>,
  newProperties: Record<string, unknown>,
  fields: FieldDefinition[],
): PropertyDiffEntry[] {
  const entries: PropertyDiffEntry[] = [];

  for (const field of fields) {
    const oldValue = formatPropertyValue(oldProperties[field.key], field);
    const newValue = formatPropertyValue(newProperties[field.key], field);
    if (oldValue === newValue) continue;
    entries.push({ key: field.key, label: field.label, oldValue, newValue });
  }

  return entries;
}
