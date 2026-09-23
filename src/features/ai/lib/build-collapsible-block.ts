import type { JSONContent } from "@tiptap/core";

function paragraph(text: string): JSONContent {
  return { type: "paragraph", content: text ? [{ type: "text", text }] : [] };
}

function bulletList(items: string[]): JSONContent {
  return { type: "bulletList", content: items.map((item) => ({ type: "listItem", content: [paragraph(item)] })) };
}

/**
 * Bloco recolhível (6.8, "Resumir": "inserido no topo como bloco recolhível") —
 * `details`/`detailsSummary`/`detailsContent` (`@tiptap/extension-details`,
 * registrado em `extensions.ts`/`render-public-content.ts`). Nasce aberto
 * (`open: true`) pra revisão imediata; o dono pode recolher depois — sem
 * JS nenhum na página pública, é `<details>`/`<summary>` nativos.
 */
export function buildCollapsibleBlock(summaryTitle: string, bodyNodes: JSONContent[]): JSONContent {
  return {
    type: "details",
    attrs: { open: true },
    content: [
      { type: "detailsSummary", content: [{ type: "text", text: summaryTitle }] },
      { type: "detailsContent", content: bodyNodes },
    ],
  };
}

/** Bloco "Resumo gerado por IA" (6.8) a partir dos bullets do `itemSummarySchema`. */
export function buildItemSummaryBlock(bullets: string[]): JSONContent {
  return buildCollapsibleBlock("Resumo gerado por IA", [bulletList(bullets)]);
}
