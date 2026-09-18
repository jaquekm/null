import type { JSONContent } from "@tiptap/core";

/** Converte texto puro (linhas separadas por `\n`) num doc Tiptap de parágrafos. */
export function textToDoc(text: string): JSONContent {
  const lines = text.split("\n");
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}
