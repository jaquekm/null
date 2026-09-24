import { describe, expect, it } from "vitest";
import { markdownToTiptapDoc } from "./markdown-to-tiptap";
import { tiptapDocToMarkdown } from "./tiptap-to-markdown";

describe("tiptapDocToMarkdown", () => {
  it("converte parágrafo simples", () => {
    expect(tiptapDocToMarkdown({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "olá mundo" }] }] })).toBe(
      "olá mundo",
    );
  });

  it("converte títulos # ## ###", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Um" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Dois" }] },
      ],
    };
    expect(tiptapDocToMarkdown(doc)).toBe("# Um\n\n## Dois");
  });

  it("converte negrito, itálico e código inline", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "forte" },
            { type: "text", text: " " },
            { type: "text", marks: [{ type: "italic" }], text: "ênfase" },
            { type: "text", text: " " },
            { type: "text", marks: [{ type: "code" }], text: "código" },
          ],
        },
      ],
    };
    expect(tiptapDocToMarkdown(doc)).toBe("**forte** *ênfase* `código`");
  });

  it("converte lista com marcadores", () => {
    const doc = {
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
    };
    expect(tiptapDocToMarkdown(doc)).toBe("- a\n- b");
  });

  it("converte lista numerada", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "um" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "dois" }] }] },
          ],
        },
      ],
    };
    expect(tiptapDocToMarkdown(doc)).toBe("1. um\n2. dois");
  });

  it("converte lista de tarefas com checked", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] },
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }] },
          ],
        },
      ],
    };
    expect(tiptapDocToMarkdown(doc)).toBe("- [ ] a\n- [x] b");
  });

  it("converte citação", () => {
    const doc = { type: "doc", content: [{ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "algo" }] }] }] };
    expect(tiptapDocToMarkdown(doc)).toBe("> algo");
  });

  it("converte tabela", () => {
    const doc = {
      type: "doc",
      content: [
        {
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
        },
      ],
    };
    expect(tiptapDocToMarkdown(doc)).toBe("| Nome | Idade |\n| --- | --- |\n| Ana | 30 |");
  });

  it("converte menção de item e de contato em [[label]] (7.4: export completo)", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Ver " },
            { type: "mention", attrs: { id: "item-1", label: "Reunião de terça" } },
            { type: "text", text: " com " },
            { type: "contactMention", attrs: { id: "contact-1", label: "Maria" } },
          ],
        },
      ],
    };
    expect(tiptapDocToMarkdown(doc)).toBe("Ver [[Reunião de terça]] com [[Maria]]");
  });

  it("doc nulo ou vazio vira string vazia", () => {
    expect(tiptapDocToMarkdown(null)).toBe("");
    expect(tiptapDocToMarkdown({ type: "doc", content: [{ type: "paragraph", content: [] }] })).toBe("");
  });
});

describe("ida e volta markdownToTiptapDoc ↔ tiptapDocToMarkdown", () => {
  const cases = [
    "# Título",
    "olá mundo",
    "**forte** *ênfase* `código`",
    "- a\n- b",
    "1. um\n2. dois",
    "- [ ] a\n- [x] b",
    "> algo",
  ];

  it.each(cases)("%s sobrevive à ida e volta", (markdown) => {
    const doc = markdownToTiptapDoc(markdown);
    const roundTripped = tiptapDocToMarkdown(doc);
    expect(markdownToTiptapDoc(roundTripped)).toEqual(doc);
  });
});
