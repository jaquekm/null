import { describe, expect, it } from "vitest";
import { htmlToTiptapDoc } from "./html-to-tiptap";

describe("htmlToTiptapDoc", () => {
  it("tabela do Word (sem <th>) vira tabela com a 1ª linha de cabeçalho — antes cada célula virava um parágrafo solto", () => {
    const doc = htmlToTiptapDoc(
      "<table><tr><td><p>Nível</p></td><td><p>O que fazer</p></td></tr><tr><td><p>0–2</p></td><td><p>Continue e <strong>anote</strong></p></td></tr></table>",
    );
    const table = doc.content![0]!;
    expect(table.type).toBe("table");
    expect(table.content).toHaveLength(2);
    expect(table.content![0]!.content!.map((c) => c.type)).toEqual(["tableHeader", "tableHeader"]);
    expect(table.content![1]!.content!.map((c) => c.type)).toEqual(["tableCell", "tableCell"]);
    const lastCell = table.content![1]!.content![1]!;
    expect(lastCell.content![0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Continue e " }, { type: "text", text: "anote", marks: [{ type: "bold" }] }],
    });
  });

  it("títulos, listas, negrito e links chegam como blocos do editor; âncoras internas do Word somem", () => {
    const doc = htmlToTiptapDoc(
      '<h1><a id="_Toc1"></a>Programa</h1><h2>Como usar</h2><p>Leia <em>antes</em> <a href="https://x.com">aqui</a>.</p><ul><li>Joelho alinhado</li><li>Sem travar</li></ul><ol><li>Um</li></ol><h4>Fundo</h4>',
    );
    expect(doc.content!.map((b) => b.type)).toEqual(["heading", "heading", "paragraph", "bulletList", "orderedList", "heading"]);
    expect(doc.content![0]).toEqual({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Programa" }] });
    expect(doc.content![5]!.attrs).toEqual({ level: 3 });
    const paragraphText = doc.content![2]!.content!;
    expect(paragraphText).toContainEqual({ type: "text", text: "antes", marks: [{ type: "italic" }] });
    expect(paragraphText).toContainEqual({ type: "text", text: "aqui", marks: [{ type: "link", attrs: { href: "https://x.com" } }] });
    expect(doc.content![3]!.content).toHaveLength(2);
  });

  it("HTML vazio ainda devolve um documento válido", () => {
    expect(htmlToTiptapDoc("")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });
});
