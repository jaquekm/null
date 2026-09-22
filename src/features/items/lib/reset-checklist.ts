import type { JSONContent } from "@tiptap/core";

/**
 * Desmarca todo `taskItem` do conteúdo (5.9: "Duplicar como nova" — mantém
 * os itens da lista, desmarca todos). Pura e recursiva: um `taskItem` pode
 * ter sub-listas aninhadas.
 */
export function resetChecklist(doc: JSONContent | null): JSONContent | null {
  if (!doc) return doc;

  function walk(node: JSONContent): JSONContent {
    const next: JSONContent = node.type === "taskItem" ? { ...node, attrs: { ...node.attrs, checked: false } } : { ...node };
    if (node.content) next.content = node.content.map(walk);
    return next;
  }

  return walk(doc);
}
