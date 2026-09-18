import { describe, expect, it } from "vitest";
import { extractText } from "./extract-text";

describe("extractText", () => {
  it("retorna string vazia para doc nulo", () => {
    expect(extractText(null)).toBe("");
  });

  it("junta parágrafos em linhas separadas", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Primeira linha" }] },
        { type: "paragraph", content: [{ type: "text", text: "Segunda linha" }] },
      ],
    };
    expect(extractText(doc)).toBe("Primeira linha\nSegunda linha");
  });

  it("concatena vários nós de texto (com marcas) dentro do mesmo parágrafo", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Olá " },
            { type: "text", text: "mundo", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    expect(extractText(doc)).toBe("Olá mundo");
  });

  it("trata título como sua própria linha", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Título" }] },
        { type: "paragraph", content: [{ type: "text", text: "Corpo" }] },
      ],
    };
    expect(extractText(doc)).toBe("Título\nCorpo");
  });

  it("extrai texto de itens de lista (parágrafo dentro do listItem) sem linha extra", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Item 1" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Item 2" }] }] },
          ],
        },
      ],
    };
    expect(extractText(doc)).toBe("Item 1\nItem 2");
  });

  it("preserva quebras internas de um bloco de código", () => {
    const doc = {
      type: "doc",
      content: [{ type: "codeBlock", content: [{ type: "text", text: "linha 1\nlinha 2" }] }],
    };
    expect(extractText(doc)).toBe("linha 1\nlinha 2");
  });

  it("representa parágrafo vazio como linha em branco", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "A" }] },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "B" }] },
      ],
    };
    expect(extractText(doc)).toBe("A\n\nB");
  });
});
