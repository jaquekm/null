import { listStyleSchema, LIST_STYLE_INFO, type ListStyle } from "@/features/items/lib/list-styles";

export interface BrowserTag {
  id: string;
  name: string;
  color: string | null;
}

export interface BrowserItem {
  id: string;
  title: string;
  typeId: string | null;
  typeName: string | null;
  typeIcon: string | null;
  typeSlug: string | null;
  /** Só em listas (tipo `lista`); lista antiga sem tipo conta como "Riscar". */
  listStyle: ListStyle | null;
  tags: BrowserTag[];
  updatedAt: string;
}

export interface BrowserFilters {
  q: string;
  typeId: string;
  tagId: string;
  listStyle: string;
}

export const EMPTY_FILTERS: BrowserFilters = { q: "", typeId: "", tagId: "", listStyle: "" };

/** Tipo de lista gravado no item → valor do filtro. Fora de lista é `null`. */
export function listStyleFor(typeSlug: string | null, raw: unknown): ListStyle | null {
  if (typeSlug !== "lista") return null;
  const parsed = listStyleSchema.safeParse(raw);
  return parsed.success ? parsed.data : "checklist";
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

type Dimension = keyof BrowserFilters;

function matches(item: BrowserItem, filters: BrowserFilters, skip?: Dimension): boolean {
  if (skip !== "q" && filters.q && !normalize(item.title).includes(normalize(filters.q))) return false;
  if (skip !== "typeId" && filters.typeId && item.typeId !== filters.typeId) return false;
  if (skip !== "tagId" && filters.tagId && !item.tags.some((tag) => tag.id === filters.tagId)) return false;
  if (skip !== "listStyle" && filters.listStyle && item.listStyle !== filters.listStyle) return false;
  return true;
}

export function filterBrowserItems(items: BrowserItem[], filters: BrowserFilters): BrowserItem[] {
  return items.filter((item) => matches(item, filters));
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface BrowserFacets {
  types: FacetOption[];
  tags: FacetOption[];
  listStyles: FacetOption[];
}

function tally(entries: { value: string; label: string }[]): FacetOption[] {
  const byValue = new Map<string, FacetOption>();
  for (const { value, label } of entries) {
    const current = byValue.get(value);
    if (current) current.count += 1;
    else byValue.set(value, { value, label, count: 1 });
  }
  return [...byValue.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}

/**
 * Opções de cada filtro com a quantidade de itens — contando com os OUTROS
 * filtros já aplicados (escolher "Lista" mostra só as subcategorias que têm
 * listas). Só aparece o que existe no espaço: nada de 20 tipos vazios.
 */
export function browserFacets(items: BrowserItem[], filters: BrowserFilters): BrowserFacets {
  const types = tally(
    items
      .filter((item) => item.typeId && matches(item, filters, "typeId"))
      .map((item) => ({ value: item.typeId as string, label: `${item.typeIcon ? `${item.typeIcon} ` : ""}${item.typeName ?? "Sem tipo"}` })),
  );
  const tags = tally(items.filter((item) => matches(item, filters, "tagId")).flatMap((item) => item.tags.map((tag) => ({ value: tag.id, label: tag.name }))));
  const listStyles = tally(
    items
      .filter((item) => item.listStyle && matches(item, filters, "listStyle"))
      .map((item) => ({ value: item.listStyle as string, label: LIST_STYLE_INFO[item.listStyle as ListStyle].label })),
  );
  return { types, tags, listStyles };
}

/** Lê os filtros da URL (`?q=&tipo=&sub=&lista=`), ignorando o que não é texto. */
export function filtersFromSearchParams(params: Record<string, string | string[] | undefined>): BrowserFilters {
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  return { q: pick("q"), typeId: pick("tipo"), tagId: pick("sub"), listStyle: pick("lista") };
}

export function filtersToSearch(filters: BrowserFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.typeId) params.set("tipo", filters.typeId);
  if (filters.tagId) params.set("sub", filters.tagId);
  if (filters.listStyle) params.set("lista", filters.listStyle);
  const query = params.toString();
  return query ? `?${query}` : "";
}
