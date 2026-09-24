import { describe, expect, it } from "vitest";
import { resolveWikilinksInDoc } from "./resolve-wikilinks";

describe("resolveWikilinksInDoc", () => {
  it("troca [[Título]] por um nó mention quando o título resolve", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Ver [[Projeto Alfa]] amanhã." }] }],
    };
    const result = resolveWikilinksInDoc(doc, new Map([["projeto alfa", "item-1"]]));
    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Ver " },
            { type: "mention", attrs: { id: "item-1", label: "Projeto Alfa" } },
            { type: "text", text: " amanhã." },
          ],
        },
      ],
    });
  });

  it("título sem correspondência fica como texto solto", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "[[Não existe]]" }] }] };
    const result = resolveWikilinksInDoc(doc, new Map());
    expect(result).toEqual({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "[[Não existe]]" }] }] });
  });

  it("preserva marcas (negrito) no texto ao redor do link", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "**forte** [[Nota]]", marks: [{ type: "bold" }] }] }],
    };
    // marca aplicada ao nó de texto inteiro (não ao markdown literal) — o texto ao redor do wikilink mantém a marca original.
    const result = resolveWikilinksInDoc(doc, new Map([["nota", "item-2"]]));
    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "**forte** ", marks: [{ type: "bold" }] },
            { type: "mention", attrs: { id: "item-2", label: "Nota" } },
          ],
        },
      ],
    });
  });

  it("vários wikilinks na mesma linha, alguns resolvidos e outros não", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "[[A]] e [[B]]" }] }] };
    const result = resolveWikilinksInDoc(doc, new Map([["a", "item-a"]]));
    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "mention", attrs: { id: "item-a", label: "A" } },
            { type: "text", text: " e " },
            { type: "text", text: "[[B]]" },
          ],
        },
      ],
    });
  });

  it("doc sem colchetes duplos: devolve inalterado", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "texto normal" }] }] };
    expect(resolveWikilinksInDoc(doc, new Map())).toEqual(doc);
  });
});
