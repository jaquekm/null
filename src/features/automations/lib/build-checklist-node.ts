import type { JSONContent } from "@tiptap/core";

/** Nó Tiptap de lista de tarefas pra ação `create_checklist` (5.3) — mesmo formato de `markdown-to-tiptap.ts`. */
export function buildChecklistNode(items: string[]): JSONContent {
  return {
    type: "taskList",
    content: items.map((text) => ({
      type: "taskItem",
      attrs: { checked: false },
      content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
    })),
  };
}

/** Acrescenta o checklist ao fim do conteúdo existente do item (doc vazio se o item ainda não tem conteúdo). */
export function appendChecklistToContent(content: JSONContent | null, items: string[]): JSONContent {
  const doc: JSONContent = content ?? { type: "doc", content: [] };
  return { ...doc, content: [...(doc.content ?? []), buildChecklistNode(items)] };
}
