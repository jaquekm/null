/**
 * Busca e filtro da página de um espaço compartilhado (9.7): texto no
 * título (sem acento/maiúsculas) e, quando o link é do espaço inteiro, uma
 * subcategoria. Puro, pra rodar no navegador de quem recebe o link.
 */
export interface SpaceListItem {
  id: string;
  title: string;
  typeName: string | null;
  subcategories: string[];
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function filterSpaceItems<T extends SpaceListItem>(items: T[], query: string, subcategory: string | null): T[] {
  const wanted = fold(query);
  return items.filter(
    (item) =>
      (!subcategory || item.subcategories.includes(subcategory)) &&
      (!wanted || fold(item.title).includes(wanted) || (item.typeName !== null && fold(item.typeName).includes(wanted))),
  );
}

/** Subcategorias presentes, da mais usada pra menos (empate: ordem alfabética). */
export function spaceSubcategories(items: SpaceListItem[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) for (const name of item.subcategories) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
}
