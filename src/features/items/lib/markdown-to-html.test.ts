import { describe, expect, it } from "vitest";
import { markdownToHtml } from "./markdown-to-html";

describe("markdownToHtml", () => {
  it("converte títulos # ## ###", () => {
    expect(markdownToHtml("# Um\n## Dois\n### Três")).toBe("<h1>Um</h1><h2>Dois</h2><h3>Três</h3>");
  });

  it("converte lista com -", () => {
    expect(markdownToHtml("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  it("converte lista de tarefas com []", () => {
    expect(markdownToHtml("- [ ] fazer\n- [x] feito")).toBe(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div>fazer</div></li>' +
        '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div>feito</div></li></ul>',
    );
  });

  it("converte citação com >", () => {
    expect(markdownToHtml("> uma citação")).toBe("<blockquote><p>uma citação</p></blockquote>");
  });

  it("converte código inline com crases", () => {
    expect(markdownToHtml("use `npm install`")).toBe("<p>use <code>npm install</code></p>");
  });

  it("trata texto simples como parágrafo", () => {
    expect(markdownToHtml("texto qualquer")).toBe("<p>texto qualquer</p>");
  });

  it("escapa HTML nas entradas", () => {
    expect(markdownToHtml("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });

  it("fecha a lista ao trocar para outro tipo de bloco", () => {
    expect(markdownToHtml("- a\n# Título")).toBe("<ul><li>a</li></ul><h1>Título</h1>");
  });

  it("ignora linhas em branco entre parágrafos", () => {
    expect(markdownToHtml("a\n\nb")).toBe("<p>a</p><p>b</p>");
  });

  it("converte negrito e itálico (2.9: DOCX/OCR)", () => {
    expect(markdownToHtml("**negrito** e *itálico*")).toBe("<p><strong>negrito</strong> e <em>itálico</em></p>");
  });

  it("converte lista numerada (2.9)", () => {
    expect(markdownToHtml("1. um\n2. dois")).toBe("<ol><li>um</li><li>dois</li></ol>");
  });

  it("converte tabela Markdown em <table> (2.9: OCR preservando tabelas)", () => {
    const md = "| Nome | Idade |\n| --- | --- |\n| Ana | 30 |\n| Bia | 25 |";
    expect(markdownToHtml(md)).toBe(
      "<table><tbody><tr><th>Nome</th><th>Idade</th></tr>" +
        "<tr><td>Ana</td><td>30</td></tr><tr><td>Bia</td><td>25</td></tr></tbody></table>",
    );
  });

  it("fecha a tabela ao encontrar uma linha em branco ou outro bloco", () => {
    const md = "| a | b |\n| --- | --- |\n| 1 | 2 |\n\n# Depois";
    expect(markdownToHtml(md)).toBe(
      "<table><tbody><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></tbody></table><h1>Depois</h1>",
    );
  });
});
