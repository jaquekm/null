import { describe, expect, it } from "vitest";
import { buildCollapsibleBlock, buildItemSummaryBlock } from "./build-collapsible-block";

describe("buildCollapsibleBlock", () => {
  it("monta details/detailsSummary/detailsContent, aberto por padrão", () => {
    const block = buildCollapsibleBlock("Título", [{ type: "paragraph", content: [{ type: "text", text: "corpo" }] }]);

    expect(block).toEqual({
      type: "details",
      attrs: { open: true },
      content: [
        { type: "detailsSummary", content: [{ type: "text", text: "Título" }] },
        { type: "detailsContent", content: [{ type: "paragraph", content: [{ type: "text", text: "corpo" }] }] },
      ],
    });
  });
});

describe("buildItemSummaryBlock", () => {
  it("vira uma lista com marcadores dentro do bloco recolhível", () => {
    const block = buildItemSummaryBlock(["primeiro ponto", "segundo ponto"]);

    expect(block.type).toBe("details");
    const content = block.content!;
    expect(content[0]).toMatchObject({ type: "detailsSummary", content: [{ type: "text", text: "Resumo gerado por IA" }] });
    expect(content[1]).toMatchObject({
      type: "detailsContent",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "primeiro ponto" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "segundo ponto" }] }] },
          ],
        },
      ],
    });
  });
});
