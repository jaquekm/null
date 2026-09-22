import type { FieldDefinition } from "@/features/types/schemas";
import { formatPropertyValue } from "@/features/views/lib/format-property-value";

/**
 * Campos que referenciam outro recurso interno (`relation`/`contact`/`file`
 * — o visitante anônimo não tem como ver o que está do outro lado) e
 * `rollup` (5.8): computado a partir de outros itens do dono, que a página
 * pública não tem por que expor — deixado de fora nesta fase.
 */
const EXCLUDED_FIELD_TYPES = new Set<FieldDefinition["type"]>(["relation", "contact", "file", "rollup"]);

export interface PublicPropertyView {
  key: string;
  label: string;
  value: string;
}

/**
 * Propriedades "visíveis" de um item pra uma página pública (3.11: "montando
 * um objeto com campos permitidos... nunca... backlinks ou outros itens").
 * Nunca um campo marcado `hidden` no tipo, nem `relation`/`contact` (aponta
 * pra outro item/contato que o visitante não pode ver) nem `file` (só os
 * anexos de verdade saem, por URL assinada — nunca o caminho de storage cru
 * de um campo de arquivo).
 */
export function buildPublicProperties(properties: Record<string, unknown>, fields: FieldDefinition[]): PublicPropertyView[] {
  return fields
    .filter((field) => !field.hidden && !EXCLUDED_FIELD_TYPES.has(field.type))
    .map((field) => ({ key: field.key, label: field.label, value: formatPropertyValue(properties[field.key], field) }))
    .filter((prop) => prop.value !== "—");
}
