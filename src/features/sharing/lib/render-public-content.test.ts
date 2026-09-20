import { describe, expect, it } from "vitest";
import { renderPublicContentHtml } from "./render-public-content";

describe("renderPublicContentHtml", () => {
  it("null: string vazia", () => {
    expect(renderPublicContentHtml(null)).toBe("");
  });

  it("parágrafo simples", () => {
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Olá, mundo." }] }] };
    expect(renderPublicContentHtml(content)).toContain("Olá, mundo.");
  });

  it("menção de item ([[...]]): texto simples, sem link", () => {
    const content = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "mention", attrs: { id: "item-1", label: "Minha nota" } }] }],
    };
    const html = renderPublicContentHtml(content);
    expect(html).toContain("[[Minha nota]]");
    expect(html).not.toContain("href");
    expect(html).not.toContain("/itens/");
  });

  it("menção de contato (@...): texto simples, sem link", () => {
    const content = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "contactMention", attrs: { id: "contact-1", label: "Beatriz" } }] }],
    };
    const html = renderPublicContentHtml(content);
    expect(html).toContain("@Beatriz");
    expect(html).not.toContain("href");
    expect(html).not.toContain("/contatos/");
  });

  it("checklist (taskList/taskItem) preserva a marcação de concluído", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Comprar leite" }] }] },
          ],
        },
      ],
    };
    const html = renderPublicContentHtml(content);
    expect(html).toContain("Comprar leite");
    expect(html).toContain("checked");
  });

  it("checklist interativa (permissão check): taskItem vira <li> clicável com data-path", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Leite" }] }] },
          ],
        },
      ],
    };
    const html = renderPublicContentHtml(content, { interactiveChecklist: true });
    expect(html).toContain("data-share-checkbox");
    expect(html).toContain('data-path="0.0"');
    expect(html).toContain("Leite");
  });

  it("sem a opção interactiveChecklist: taskItem fica estático (sem data-share-checkbox)", () => {
    const content = {
      type: "doc",
      content: [{ type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [] }] }],
    };
    expect(renderPublicContentHtml(content)).not.toContain("data-share-checkbox");
  });

  it("script embutido no conteúdo não sobrevive à sanitização", () => {
    const content = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script>" }] }],
    };
    expect(renderPublicContentHtml(content)).not.toContain("<script>");
  });
});
