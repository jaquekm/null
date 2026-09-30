import { describe, expect, it } from "vitest";
import { filterSpaceItems, spaceSubcategories } from "./filter-space-items";

const items = [
  { id: "1", title: "Presentes pra cunhada", typeName: "Lista", subcategories: ["família", "presentes"] },
  { id: "2", title: "Reunião de condomínio", typeName: "Reunião", subcategories: ["casa"] },
  { id: "3", title: "Receita da vó", typeName: "Nota", subcategories: ["família"] },
];

describe("filterSpaceItems", () => {
  it("busca sem acento no título e no tipo", () => {
    expect(filterSpaceItems(items, "reuniao", null).map((i) => i.id)).toEqual(["2"]);
    expect(filterSpaceItems(items, "LISTA", null).map((i) => i.id)).toEqual(["1"]);
    expect(filterSpaceItems(items, "  ", null)).toHaveLength(3);
  });

  it("filtra pela subcategoria", () => {
    expect(filterSpaceItems(items, "", "família").map((i) => i.id)).toEqual(["1", "3"]);
    expect(filterSpaceItems(items, "receita", "família").map((i) => i.id)).toEqual(["3"]);
  });
});

describe("spaceSubcategories", () => {
  it("mais usadas primeiro", () => {
    expect(spaceSubcategories(items)).toEqual([
      { name: "família", count: 2 },
      { name: "casa", count: 1 },
      { name: "presentes", count: 1 },
    ]);
  });
});
