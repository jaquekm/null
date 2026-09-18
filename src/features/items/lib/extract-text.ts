import type { JSONContent } from "@tiptap/core";

/** Tipos de bloco cujo texto acumulado vira uma linha própria na saída. */
const LINE_BREAKING_TYPES = new Set(["paragraph", "heading", "codeBlock"]);

/**
 * Converte o JSON do Tiptap em texto puro, um bloco por linha — usado para
 * `items.content_text` (busca e IA).
 */
export function extractText(doc: JSONContent | null): string {
  if (!doc) return "";

  const lines: string[] = [];
  let current = "";

  function walk(node: JSONContent) {
    if (typeof node.text === "string") {
      current += node.text;
    }
    for (const child of node.content ?? []) {
      walk(child);
    }
    if (node.type && LINE_BREAKING_TYPES.has(node.type)) {
      lines.push(current);
      current = "";
    }
  }

  for (const child of doc.content ?? []) {
    walk(child);
  }
  if (current) lines.push(current);

  return lines.join("\n");
}
