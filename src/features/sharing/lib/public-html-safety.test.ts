import { describe, expect, it } from "vitest";
import { expandSelfClosingTags, sanitizePublicContent } from "./public-html-safety";

describe("sanitizePublicContent", () => {
  it("tira link javascript: mas mantém o texto e os links normais", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "ruim", marks: [{ type: "link", attrs: { href: " javascript:alert(1)" } }, { type: "bold" }] },
            { type: "text", text: "bom", marks: [{ type: "link", attrs: { href: "https://exemplo.com" } }] },
          ],
        },
      ],
    };
    const paragraph = sanitizePublicContent(doc)?.content?.[0];
    expect(paragraph?.content?.[0]).toEqual({ type: "text", text: "ruim", marks: [{ type: "bold" }] });
    expect(paragraph?.content?.[1]?.marks).toEqual([{ type: "link", attrs: { href: "https://exemplo.com" } }]);
  });

  it("remove imagem com src perigoso e mantém as seguras", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "javascript:alert(2)" } },
        { type: "image", attrs: { src: "https://x/y.png" } },
        { type: "image", attrs: { src: "data:image/png;base64,AAA" } },
        { type: "image", attrs: { src: "data:text/html,<script>" } },
      ],
    };
    expect(sanitizePublicContent(doc)?.content?.map((n) => n.attrs?.src)).toEqual(["https://x/y.png", "data:image/png;base64,AAA"]);
  });
});

describe("expandSelfClosingTags", () => {
  it("fecha elementos comuns e deixa os void como estão", () => {
    expect(expandSelfClosingTags('<h3/><p class="a"/><span data-x="1"/><img src="a"/><br/><input type="checkbox"/>')).toBe(
      '<h3></h3><p class="a"></p><span data-x="1"></span><img src="a"/><br/><input type="checkbox"/>',
    );
  });
});
