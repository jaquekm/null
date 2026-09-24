import { describe, expect, it } from "vitest";
import { buildItemMarkdown, itemFileSlug, type ItemMarkdownInput } from "@/features/export/lib/build-item-markdown";
import { markdownToTiptapDoc } from "@/features/items/lib/markdown-to-tiptap";
import { parseObsidianVault } from "./parse-obsidian";
import { resolveWikilinksInDoc } from "./resolve-wikilinks";

/**
 * Ida e volta (7.11): exportar dois itens em Markdown (`buildItemMarkdown`,
 * 7.4) e reimportar como um vault Obsidian (`parseObsidianVault`, 7.5) —
 * mesmo pipeline usado pela ação de confirmação de importação
 * (`markdownToTiptapDoc` → `resolveWikilinksInDoc`, `actions.ts`). Cobre o
 * que o enunciado pede: título, tags, datas e o link entre os dois itens
 * sobrevivem à volta inteira.
 */
describe("round-trip: exportar em Markdown → importar como Obsidian", () => {
  const itemAlfa: ItemMarkdownInput = {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Projeto Alfa",
    typeName: "Nota",
    spaceName: "Trabalho",
    tags: ["importante"],
    status: "active",
    createdAt: "2026-01-10T12:00:00.000Z",
    updatedAt: "2026-01-11T09:00:00.000Z",
    propertyLines: [],
    outgoingLinkTitles: ["Projeto Beta"],
    bodyMarkdown: "Depende do trabalho descrito em [[Projeto Beta]].",
  };

  const itemBeta: ItemMarkdownInput = {
    id: "22222222-2222-2222-2222-222222222222",
    title: "Projeto Beta",
    typeName: "Nota",
    spaceName: "Trabalho",
    tags: [],
    status: "active",
    createdAt: "2026-01-05T12:00:00.000Z",
    updatedAt: "2026-01-05T12:00:00.000Z",
    propertyLines: [],
    outgoingLinkTitles: [],
    bodyMarkdown: "Conteúdo do Beta.",
  };

  it("recria título, tags e datas dos dois itens exportados", () => {
    const files = [itemAlfa, itemBeta].map((item) => ({
      path: itemFileSlug(item.title, item.id),
      content: buildItemMarkdown(item),
    }));

    const result = parseObsidianVault(files);
    expect(result.items).toHaveLength(2);
    expect(result.warnings).toEqual([]);

    const alfa = result.items.find((i) => i.title === "Projeto Alfa");
    const beta = result.items.find((i) => i.title === "Projeto Beta");
    expect(alfa).toBeDefined();
    expect(beta).toBeDefined();

    expect(alfa!.tags).toEqual(["importante"]);
    expect(alfa!.createdAt).toBe(itemAlfa.createdAt);
    expect(alfa!.updatedAt).toBe(itemAlfa.updatedAt);
    expect(beta!.tags).toEqual([]);
  });

  it("o wikilink de saída sobrevive e resolve pro id do outro item (mesmo pipeline da ação de importação)", () => {
    const files = [itemAlfa, itemBeta].map((item) => ({
      path: itemFileSlug(item.title, item.id),
      content: buildItemMarkdown(item),
    }));

    const result = parseObsidianVault(files);
    const alfa = result.items.find((i) => i.title === "Projeto Alfa")!;
    const beta = result.items.find((i) => i.title === "Projeto Beta")!;

    expect(alfa.bodyMarkdown).toContain("[[Projeto Beta]]");

    // Simula o que `confirmImport` faz depois de criar os itens de verdade no banco.
    const newIdAlfa = "new-item-alfa";
    const newIdBeta = "new-item-beta";
    const titleToId = new Map([
      [alfa.title.toLowerCase(), newIdAlfa],
      [beta.title.toLowerCase(), newIdBeta],
    ]);

    const doc = markdownToTiptapDoc(alfa.bodyMarkdown);
    const resolvedDoc = resolveWikilinksInDoc(doc, titleToId);

    const serialized = JSON.stringify(resolvedDoc);
    expect(serialized).toContain(`"type":"mention"`);
    expect(serialized).toContain(newIdBeta);
    expect(serialized).not.toContain("[[Projeto Beta]]");
  });
});
