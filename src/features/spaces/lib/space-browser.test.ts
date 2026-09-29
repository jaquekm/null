import { describe, expect, it } from "vitest";
import {
  browserFacets,
  EMPTY_FILTERS,
  filterBrowserItems,
  filtersFromSearchParams,
  filtersToSearch,
  listStyleFor,
  type BrowserItem,
} from "./space-browser";

const cunhada = { id: "t1", name: "Cunhada", color: null };
const casa = { id: "t2", name: "Casa", color: null };
function item(id: string, title: string, typeId: string, extra: Partial<BrowserItem> = {}): BrowserItem {
  const lista = typeId === "lista";
  return {
    id,
    title,
    typeId,
    typeName: lista ? "Lista" : "Nota",
    typeIcon: lista ? "✅" : null,
    typeSlug: lista ? "lista" : "nota",
    listStyle: lista ? "checklist" : null,
    tags: [],
    updatedAt: "2026-09-29T10:00:00Z",
    ...extra,
  };
}

const items = [
  item("1", "Ideias de presentes", "lista", { listStyle: "multi", tags: [cunhada] }),
  item("2", "Mala de viagem", "lista", { tags: [casa] }),
  item("3", "Aniversário da cunhada", "nota", { tags: [cunhada] }),
  item("4", "Prioridades de vida", "lista", { listStyle: "priority" }),
];

describe("listStyleFor", () => {
  it("só lista tem tipo de lista; sem valor conta como Riscar", () => {
    expect(listStyleFor("lista", "rating")).toBe("rating");
    expect(listStyleFor("lista", undefined)).toBe("checklist");
    expect(listStyleFor("nota", "rating")).toBeNull();
  });
});

describe("filterBrowserItems", () => {
  it("combina tipo, subcategoria, tipo de lista e busca sem acento", () => {
    expect(filterBrowserItems(items, { ...EMPTY_FILTERS, tagId: "t1" }).map((i) => i.id)).toEqual(["1", "3"]);
    expect(filterBrowserItems(items, { ...EMPTY_FILTERS, typeId: "lista", tagId: "t1" }).map((i) => i.id)).toEqual(["1"]);
    expect(filterBrowserItems(items, { ...EMPTY_FILTERS, listStyle: "priority" }).map((i) => i.id)).toEqual(["4"]);
    expect(filterBrowserItems(items, { ...EMPTY_FILTERS, q: "aniversario" }).map((i) => i.id)).toEqual(["3"]);
  });
});

describe("browserFacets", () => {
  it("conta cada opção respeitando os outros filtros e só lista o que existe", () => {
    const all = browserFacets(items, EMPTY_FILTERS);
    expect(all.types).toEqual([
      { value: "lista", label: "✅ Lista", count: 3 },
      { value: "nota", label: "Nota", count: 1 },
    ]);
    expect(all.tags).toEqual([
      { value: "t1", label: "Cunhada", count: 2 },
      { value: "t2", label: "Casa", count: 1 },
    ]);
    expect(all.listStyles.map((o) => [o.label, o.count])).toEqual([
      ["Marcar vários", 1],
      ["Ordenar e agrupar", 1],
      ["Riscar", 1],
    ]);

    const onlyCunhada = browserFacets(items, { ...EMPTY_FILTERS, tagId: "t1" });
    expect(onlyCunhada.types.map((o) => [o.value, o.count])).toEqual([
      ["lista", 1],
      ["nota", 1],
    ]);
    // A própria dimensão não se filtra: com "Cunhada" escolhida, "Casa" continua aparecendo pra trocar.
    expect(onlyCunhada.tags.map((o) => o.value)).toEqual(["t1", "t2"]);
  });
});

describe("filtros na URL", () => {
  it("ida e volta", () => {
    const filters = { q: "presente", typeId: "lista", tagId: "t1", listStyle: "multi" };
    expect(filtersToSearch(filters)).toBe("?q=presente&tipo=lista&sub=t1&lista=multi");
    expect(filtersFromSearchParams({ q: "presente", tipo: "lista", sub: "t1", lista: "multi" })).toEqual(filters);
    expect(filtersFromSearchParams({ q: ["a", "b"] })).toEqual(EMPTY_FILTERS);
    expect(filtersToSearch(EMPTY_FILTERS)).toBe("");
  });
});
