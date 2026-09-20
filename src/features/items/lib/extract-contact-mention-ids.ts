import type { JSONContent } from "@tiptap/core";

/** Retorna os ids únicos dos nós `contactMention` (menção `@contato` no editor, 3.3). */
export function extractContactMentionIds(doc: JSONContent | null): string[] {
  if (!doc) return [];

  const ids = new Set<string>();

  function walk(node: JSONContent) {
    if (node.type === "contactMention" && typeof node.attrs?.id === "string") {
      ids.add(node.attrs.id);
    }
    for (const child of node.content ?? []) {
      walk(child);
    }
  }

  walk(doc);
  return [...ids];
}
