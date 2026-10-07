import { listStyleOf, type ListStyle } from "@/features/items/lib/list-styles";

/**
 * Só item do tipo "Lista" aceita edição por link. O tipo da lista (riscar, dar
 * nota…) vem de `properties.list_style`; sem ele, é "riscar" — o mesmo padrão do app.
 */
export function editableListStyle(typeSlug: string | null | undefined, properties: Record<string, unknown> | null | undefined): ListStyle | null {
  return typeSlug === "lista" ? listStyleOf(properties) : null;
}
