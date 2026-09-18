import { slugify } from "@/lib/slugify";

/**
 * Gera a `key` de um campo a partir do label (1.5: "`key` é gerada do label
 * na criação... e não muda depois"). Usa o mesmo `slugify` dos espaços, mas
 * com `_` no lugar de `-` para bater com `fieldDefinitionSchema.key`
 * (`^[a-z][a-z0-9_]*$`), e garante que comece com letra.
 */
export function fieldKeyFromLabel(label: string): string {
  const base = slugify(label).replace(/-/g, "_");
  return /^[a-z]/.test(base) ? base : `campo_${base}`;
}

/** Garante que a key não colida com as já existentes no tipo, tipo `prazo_2`. */
export function uniqueFieldKey(label: string, existingKeys: string[]): string {
  const base = fieldKeyFromLabel(label);
  const taken = new Set(existingKeys);
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}
