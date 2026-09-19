import { describe, expect, it } from "vitest";
import { markdownToTiptapDoc } from "./markdown-to-tiptap";

describe("markdownToTiptapDoc", () => {
  it("converte títulos # ## ###", () => {
    expect(markdownToTiptapDoc("# Um\n## Dois")).toEqual({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Um" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Dois" }] },
      ],
    });
  });

  it("converte parágrafo simples", () => {
    expect(markdownToTiptapDoc("olá mundo")).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "olá mundo" }] }],
    });
  });

  it("converte negrito, itálico e código inline", () => {
    const doc = markdownToTiptapDoc("**forte** *ênfase* `código`");
    expect(doc.content?.[0]?.content).toEqual([
      { type: "text", marks: [{ type: "bold" }], text: "forte" },
      { type: "text", text: " " },
      { type: "text", marks: [{ type: "italic" }], text: "ênfase" },
      { type: "text", text: " " },
      { type: "text", marks: [{ type: "code" }], text: "código" },
    ]);
  });

  it("agrupa itens de lista consecutivos num único nó de lista", () => {
    expect(markdownToTiptapDoc("- a\n- b")).toEqual({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }] },
          ],
        },
      ],
    });
  });

  it("lista numerada vira orderedList", () => {
    const doc = markdownToTiptapDoc("1. um\n2. dois");
    expect(doc.content?.[0]?.type).toBe("orderedList");
    expect(doc.content?.[0]?.content).toHaveLength(2);
  });

  it("lista de tarefas vira taskList/taskItem com `checked`", () => {
    const doc = markdownToTiptapDoc("- [ ] a\n- [x] b");
    expect(doc.content?.[0]).toMatchObject({
      type: "taskList",
      content: [
        { type: "taskItem", attrs: { checked: false } },
        { type: "taskItem", attrs: { checked: true } },
      ],
    });
  });

  it("trocar de tipo de lista fecha a anterior e abre uma nova", () => {
    const doc = markdownToTiptapDoc("- a\n1. b");
    expect(doc.content).toHaveLength(2);
    expect(doc.content?.[0]?.type).toBe("bulletList");
    expect(doc.content?.[1]?.type).toBe("orderedList");
  });

  it("converte citação", () => {
    expect(markdownToTiptapDoc("> algo")).toEqual({
      type: "doc",
      content: [{ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "algo" }] }] }],
    });
  });

  it("converte tabela Markdown em table/tableRow/tableHeader/tableCell", () => {
    const doc = markdownToTiptapDoc("| Nome | Idade |\n| --- | --- |\n| Ana | 30 |");
    expect(doc.content?.[0]).toMatchObject({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Nome" }] }] },
            { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Idade" }] }] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Ana" }] }] },
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "30" }] }] },
          ],
        },
      ],
    });
  });

  it("texto vazio vira um doc com um parágrafo vazio (nunca um doc sem conteúdo)", () => {
    expect(markdownToTiptapDoc("")).toEqual({ type: "doc", content: [{ type: "paragraph", content: [] }] });
  });
});
