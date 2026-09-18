import type { FieldType } from "../schemas";

/**
 * Grupos de tipo de campo compatíveis entre si (1.5: "mudar o tipo de um
 * campo é permitido só entre tipos compatíveis"). `select -> multi_select`
 * é uma via só, como no enunciado ("select → multi_select"); os demais
 * grupos são de mão dupla.
 */
const BIDIRECTIONAL_GROUPS: FieldType[][] = [
  ["text", "long_text"],
  ["number", "percent", "rating"],
];

const ONE_WAY: Partial<Record<FieldType, FieldType[]>> = {
  select: ["multi_select"],
};

export function canChangeFieldType(from: FieldType, to: FieldType): boolean {
  if (from === to) return true;
  if (ONE_WAY[from]?.includes(to)) return true;
  return BIDIRECTIONAL_GROUPS.some((group) => group.includes(from) && group.includes(to));
}
