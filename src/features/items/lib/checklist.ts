import type { JSONContent } from "@tiptap/core";

export interface ChecklistItem {
  /** Posição do `taskItem` na ordem do documento (achatando aninhamento) — usada por `toggleChecklistItem`. */
  index: number;
  text: string;
  checked: boolean;
}

/** Texto direto do `taskItem` — não desce em `taskList` aninhado (aquilo vira entradas próprias em `flattenChecklist`). */
function textOf(node: JSONContent): string {
  let text = "";
  function walk(n: JSONContent) {
    if (typeof n.text === "string") text += n.text;
    if (n.type === "taskList") return;
    for (const child of n.content ?? []) walk(child);
  }
  for (const child of node.content ?? []) walk(child);
  return text;
}

/**
 * "Modo lista" (5.9, pack Listas): achata todo `taskItem` do documento, em
 * ordem — inclusive aninhados — numa lista simples de `{text, checked}`.
 * Perde a hierarquia de propósito (é uma visão simplificada pra celular,
 * não o editor completo); quem ordena "marcados vão pro fim" é quem exibe,
 * não esta função (mantém a ordem de armazenamento estável).
 */
export function flattenChecklist(doc: JSONContent | null): ChecklistItem[] {
  if (!doc) return [];
  const items: ChecklistItem[] = [];

  function walk(node: JSONContent) {
    if (node.type === "taskItem") {
      items.push({ index: items.length, text: textOf(node), checked: node.attrs?.checked === true });
    }
    for (const child of node.content ?? []) walk(child);
  }
  walk(doc);
  return items;
}

/** Marca/desmarca o N-ésimo `taskItem` (mesma ordem de `flattenChecklist`) — não mexe em mais nada do documento. */
export function toggleChecklistItem(doc: JSONContent, index: number, checked: boolean): JSONContent {
  let seen = -1;
  function walk(node: JSONContent): JSONContent {
    if (node.type === "taskItem") {
      seen += 1;
      if (seen === index) return { ...node, attrs: { ...node.attrs, checked } };
    }
    if (node.content) return { ...node, content: node.content.map(walk) };
    return node;
  }
  return walk(doc);
}

function paragraph(text: string): JSONContent {
  return { type: "paragraph", content: text ? [{ type: "text", text }] : [] };
}

function newTaskItem(text: string): JSONContent {
  return { type: "taskItem", attrs: { checked: false }, content: [paragraph(text)] };
}

/**
 * Acrescenta um item novo ao **último** `taskList` de nível superior do
 * documento (cria um, no fim, se não houver nenhum) — usado pelo "adicionar
 * com Enter" do modo lista.
 */
export function appendChecklistItem(doc: JSONContent | null, text: string): JSONContent {
  const base: JSONContent = doc ?? { type: "doc", content: [] };
  const content = base.content ?? [];
  const lastTaskListIndex = [...content].map((node) => node.type).lastIndexOf("taskList");

  if (lastTaskListIndex === -1) {
    return { ...base, content: [...content, { type: "taskList", content: [newTaskItem(text)] }] };
  }

  const nextContent = content.map((node, i) => (i === lastTaskListIndex ? { ...node, content: [...(node.content ?? []), newTaskItem(text)] } : node));
  return { ...base, content: nextContent };
}
