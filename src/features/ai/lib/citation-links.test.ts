import { describe, expect, it } from "vitest";
import { buildCitationHref, findCitationMatches } from "./citation-links";
import type { AskSource } from "./ask-context";

function source(overrides: Partial<AskSource> = {}): AskSource {
  return { n: 1, chunkId: "c1", itemId: "item-1", title: "Item", excerpt: "excerto", location: "", seekSeconds: null, page: null, ...overrides };
}

describe("buildCitationHref", () => {
  it("com seekSeconds: link pro tempo da transcrição", () => {
    expect(buildCitationHref({ itemId: "item-1", seekSeconds: 92.7, page: null })).toBe("/itens/item-1?t=92");
  });

  it("com page: link pra página do anexo", () => {
    expect(buildCitationHref({ itemId: "item-1", seekSeconds: null, page: 4 })).toBe("/itens/item-1?page=4");
  });

  it("sem nenhum dos dois: link liso pro item", () => {
    expect(buildCitationHref({ itemId: "item-1", seekSeconds: null, page: null })).toBe("/itens/item-1");
  });
});

describe("findCitationMatches", () => {
  it("encontra cada [n] e resolve pra fonte correspondente", () => {
    const sources = [source({ n: 1, itemId: "item-1" }), source({ n: 2, itemId: "item-2" })];

    const matches = findCitationMatches("O orçamento foi aprovado [1] e o prazo definido [2].", sources);

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ raw: "[1]", n: 1, source: sources[0] });
    expect(matches[1]).toMatchObject({ raw: "[2]", n: 2, source: sources[1] });
  });

  it("número fora da lista de fontes: source null", () => {
    const matches = findCitationMatches("Texto [9]", []);

    expect(matches).toEqual([{ index: 6, raw: "[9]", n: 9, source: null }]);
  });

  it("sem citações no texto: lista vazia", () => {
    expect(findCitationMatches("Sem nenhuma citação aqui.", [source()])).toEqual([]);
  });
});
