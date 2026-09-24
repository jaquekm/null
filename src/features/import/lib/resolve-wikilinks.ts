import type { JSONContent } from "@tiptap/core";

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function textNode(text: string, marks: JSONContent["marks"]): JSONContent {
  return marks ? { type: "text", text, marks } : { type: "text", text };
}

function splitTextNode(node: JSONContent, titleToId: Map<string, string>): JSONContent[] {
  const text = node.text ?? "";
  WIKILINK_RE.lastIndex = 0;
  if (!text.includes("[[") || !WIKILINK_RE.test(text)) return [node];
  WIKILINK_RE.lastIndex = 0;

  const pieces: JSONContent[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WIKILINK_RE.exec(text))) {
    if (match.index > lastIndex) pieces.push(textNode(text.slice(lastIndex, match.index), node.marks));

    const label = match[1]!.trim();
    const id = titleToId.get(normalizeTitle(label));
    pieces.push(id ? { type: "mention", attrs: { id, label } } : textNode(match[0], node.marks));

    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) pieces.push(textNode(text.slice(lastIndex), node.marks));
  return pieces;
}

function walk(node: JSONContent, titleToId: Map<string, string>): JSONContent {
  if (!node.content) return node;
  const content: JSONContent[] = [];
  for (const child of node.content) {
    if (child.type === "text") content.push(...splitTextNode(child, titleToId));
    else content.push(walk(child, titleToId));
  }
  return { ...node, content };
}

/**
 * Segunda passada depois de criar todos os itens do lote (7.5, Obsidian:
 * "`[[wikilinks]]` → links (segunda passada após criar todos os itens)") —
 * troca `[[Título]]` em texto puro por um nó `mention` de verdade quando o
 * título resolve pra um id conhecido (item deste lote ou já existente no
 * espaço de destino); título sem correspondência fica como texto solto,
 * sem quebrar nada.
 */
export function resolveWikilinksInDoc(doc: JSONContent, titleToId: Map<string, string>): JSONContent {
  return walk(doc, titleToId);
}
