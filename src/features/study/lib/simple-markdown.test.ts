import { describe, expect, it } from "vitest";
import { renderSimpleMarkdown } from "./simple-markdown";

describe("renderSimpleMarkdown", () => {
  it("aplica negrito, itálico (* e _) e código", () => {
    expect(renderSimpleMarkdown("**bold** e *italic* e _também_ e `code`")).toBe(
      "<strong>bold</strong> e <em>italic</em> e <em>também</em> e <code>code</code>",
    );
  });

  it("quebra de linha vira <br />", () => {
    expect(renderSimpleMarkdown("linha1\nlinha2")).toBe("linha1<br />linha2");
  });

  it("imagem e link com URL http(s)", () => {
    expect(renderSimpleMarkdown("![capa](https://x.com/a.png)")).toBe('<img src="https://x.com/a.png" alt="capa" class="max-w-full rounded" />');
    expect(renderSimpleMarkdown("[site](https://x.com)")).toBe('<a href="https://x.com" target="_blank" rel="noopener noreferrer" class="underline">site</a>');
  });

  it("escapa HTML antes de aplicar as regras", () => {
    expect(renderSimpleMarkdown("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("bloqueia esquema de URL perigoso (javascript:) em imagem e link", () => {
    expect(renderSimpleMarkdown("![x](javascript:alert(1))")).toContain('src="#"');
    expect(renderSimpleMarkdown("[x](javascript:alert(1))")).toContain('href="#"');
  });

  it("não mexe em texto sem marcação", () => {
    expect(renderSimpleMarkdown("texto simples")).toBe("texto simples");
  });
});
