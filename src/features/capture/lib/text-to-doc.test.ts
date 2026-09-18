import { describe, expect, it } from "vitest";
import { textToDoc } from "./text-to-doc";

describe("textToDoc", () => {
  it("uma linha vira um parágrafo", () => {
    expect(textToDoc("olá")).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "olá" }] }],
    });
  });

  it("várias linhas viram vários parágrafos", () => {
    const doc = textToDoc("linha 1\nlinha 2");
    expect(doc.content).toHaveLength(2);
    expect(doc.content?.[0]).toEqual({ type: "paragraph", content: [{ type: "text", text: "linha 1" }] });
    expect(doc.content?.[1]).toEqual({ type: "paragraph", content: [{ type: "text", text: "linha 2" }] });
  });

  it("linha vazia vira parágrafo sem conteúdo", () => {
    const doc = textToDoc("a\n\nb");
    expect(doc.content?.[1]).toEqual({ type: "paragraph", content: [] });
  });

  it("texto vazio ainda produz um doc com um parágrafo (Tiptap exige pelo menos um bloco)", () => {
    const doc = textToDoc("");
    expect(doc.content).toEqual([{ type: "paragraph", content: [] }]);
  });
});
