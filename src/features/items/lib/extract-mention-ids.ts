import type { JSONContent } from "@tiptap/core";

/** Retorna os ids únicos dos nós `mention` (links `[[...]]` para outros itens). */
export function extractMentionIds(doc: JSONContent | null): string[] {
  if (!doc) return [];

  const ids = new Set<string>();

  function walk(node: JSONContent) {
    if (node.type === "mention" && typeof node.attrs?.id === "string") {
      ids.add(node.attrs.id);
    }
    for (const child of node.content ?? []) {
      walk(child);
    }
  }

  walk(doc);
  return [...ids];
}
