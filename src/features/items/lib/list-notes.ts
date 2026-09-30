import type { JSONContent } from "@tiptap/core";
import type { ListStyle } from "./list-styles";

/**
 * O texto de uma lista que não é item de lista (parágrafos, tópicos, títulos
 * soltos) — o modo lista (5.9) só mostrava as linhas com caixinha e esse
 * texto sumia da tela, apesar de continuar salvo. Agora aparece em cima da
 * lista, e dá pra transformar as linhas em itens.
 */
export interface NoteLine {
  kind: "heading" | "text" | "bullet";
  text: string;
}

function inlineText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(inlineText).join("");
}

function linesOfParagraph(node: JSONContent): string[] {
  return inlineText(node)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listItemTexts(list: JSONContent): string[] {
  const texts: string[] = [];
  for (const item of list.content ?? []) {
    for (const child of item.content ?? []) {
      if (child.type === "paragraph") texts.push(...linesOfParagraph(child));
      else if (child.type === "bulletList" || child.type === "orderedList") texts.push(...listItemTexts(child));
    }
  }
  return texts;
}

/** No "Ordenar e agrupar", título é nome de grupo (aparece na própria lista); nos outros tipos, é texto. */
function isNoteBlock(block: JSONContent, style: ListStyle): boolean {
  if (block.type === "taskList") return false;
  if (block.type === "heading") return style !== "priority";
  return true;
}

/** Linhas de texto fora da lista, na ordem do documento. */
export function listNoteLines(doc: JSONContent | null, style: ListStyle): NoteLine[] {
  const lines: NoteLine[] = [];
  for (const block of doc?.content ?? []) {
    if (!isNoteBlock(block, style)) continue;
    if (block.type === "heading") {
      const text = inlineText(block).trim();
      if (text) lines.push({ kind: "heading", text });
    } else if (block.type === "bulletList" || block.type === "orderedList") {
      for (const text of listItemTexts(block)) lines.push({ kind: "bullet", text });
    } else if (block.type === "paragraph") {
      for (const text of linesOfParagraph(block)) lines.push({ kind: "text", text });
    } else {
      const text = inlineText(block).trim();
      if (text) lines.push({ kind: "text", text });
    }
  }
  return lines;
}

function taskList(texts: string[]): JSONContent {
  return {
    type: "taskList",
    content: texts.map((text) => ({ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text }] }] })),
  };
}

/**
 * "Transformar as linhas em itens da lista": cada linha de parágrafo e cada
 * tópico viram um item com caixinha, no mesmo lugar do documento (grupos do
 * "Ordenar e agrupar" continuam onde estão). Títulos e o que não é texto
 * simples (imagem, tabela…) ficam como estão.
 */
export function noteLinesToListItems(doc: JSONContent | null): JSONContent {
  const content: JSONContent[] = [];
  for (const block of doc?.content ?? []) {
    let texts: string[] | null = null;
    if (block.type === "paragraph") texts = linesOfParagraph(block);
    else if (block.type === "bulletList" || block.type === "orderedList") texts = listItemTexts(block);

    if (texts === null) {
      content.push(block);
      continue;
    }
    if (texts.length === 0) continue; // parágrafo vazio some
    const previous = content[content.length - 1];
    // Linhas seguidas viram uma lista só (não uma lista por parágrafo).
    if (previous?.type === "taskList") content[content.length - 1] = { ...previous, content: [...(previous.content ?? []), ...(taskList(texts).content ?? [])] };
    else content.push(taskList(texts));
  }
  return { ...(doc ?? { type: "doc" }), type: "doc", content };
}

/** Tem linha que dá pra virar item? (mostra o botão só quando faz sentido) */
export function hasConvertibleLines(doc: JSONContent | null, style: ListStyle): boolean {
  return listNoteLines(doc, style).some((line) => line.kind !== "heading");
}
