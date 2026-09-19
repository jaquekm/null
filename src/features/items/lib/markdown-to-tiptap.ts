import type { JSONContent } from "@tiptap/core";

/**
 * Irmã de `markdown-to-html.ts`, mas gera `JSONContent` do Tiptap direto,
 * sem passar por HTML — usada no servidor (2.9: "Criar nota a partir do
 * documento"), onde não existe `window`/DOM (o `generateJSON` do Tiptap
 * exige `window.DOMParser`, que só existe no navegador). Cobre o mesmo
 * subconjunto de Markdown que `markdownToHtml` (`#`, `-`, `1.`, `[]`, `>`,
 * crases, `**negrito**`, `*itálico*`, tabelas `| a | b |`) — qualquer atalho
 * novo precisa ser adicionado nas duas.
 */

function parseInline(text: string): JSONContent[] {
  if (!text) return [];
  const nodes: JSONContent[] = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
    if (match[1] !== undefined) nodes.push({ type: "text", marks: [{ type: "code" }], text: match[1] });
    else if (match[2] !== undefined) nodes.push({ type: "text", marks: [{ type: "bold" }], text: match[2] });
    else if (match[3] !== undefined) nodes.push({ type: "text", marks: [{ type: "italic" }], text: match[3] });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push({ type: "text", text: text.slice(lastIndex) });
  return nodes;
}

function paragraph(text: string): JSONContent {
  return { type: "paragraph", content: parseInline(text) };
}

function heading(level: number, text: string): JSONContent {
  return { type: "heading", attrs: { level }, content: parseInline(text) };
}

function listItem(text: string): JSONContent {
  return { type: "listItem", content: [paragraph(text)] };
}

function taskItem(text: string, checked: boolean): JSONContent {
  return { type: "taskItem", attrs: { checked }, content: [paragraph(text)] };
}

function tableCell(type: "tableHeader" | "tableCell", text: string): JSONContent {
  return { type, content: [paragraph(text)] };
}

/** `| a | b |` → células, sem as barras das pontas. */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

const TABLE_SEPARATOR_PATTERN = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

type ListType = "bulletList" | "orderedList" | "taskList";

export function markdownToTiptapDoc(markdown: string): JSONContent {
  const lines = markdown.split(/\r?\n/);
  const content: JSONContent[] = [];
  let currentList: { type: ListType; items: JSONContent[] } | null = null;

  function flushList() {
    if (currentList) content.push({ type: currentList.type, content: currentList.items });
    currentList = null;
  }

  function pushToList(type: ListType, item: JSONContent) {
    if (!currentList || currentList.type !== type) {
      flushList();
      currentList = { type, items: [] };
    }
    currentList.items.push(item);
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(line);
    const taskMatch = /^[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line);
    const bulletMatch = !taskMatch ? /^[-*]\s+(.*)$/.exec(line) : null;
    const orderedMatch = /^\d+\.\s+(.*)$/.exec(line);
    const quoteMatch = /^>\s?(.*)$/.exec(line);
    const isTableStart = line.includes("|") && i + 1 < lines.length && TABLE_SEPARATOR_PATTERN.test(lines[i + 1]!.trim());

    if (isTableStart) {
      flushList();
      const rows: JSONContent[] = [
        { type: "tableRow", content: splitTableRow(line).map((cell) => tableCell("tableHeader", cell)) },
      ];
      i += 2; // pula o cabeçalho e a linha de separação (---)
      while (i < lines.length && lines[i]!.includes("|") && lines[i]!.trim() !== "") {
        rows.push({ type: "tableRow", content: splitTableRow(lines[i]!).map((cell) => tableCell("tableCell", cell)) });
        i++;
      }
      content.push({ type: "table", content: rows });
      continue;
    }

    if (headingMatch) {
      flushList();
      content.push(heading(headingMatch[1]!.length, headingMatch[2]!));
      i++;
      continue;
    }

    if (taskMatch) {
      pushToList("taskList", taskItem(taskMatch[2]!, taskMatch[1]!.toLowerCase() === "x"));
      i++;
      continue;
    }

    if (bulletMatch) {
      pushToList("bulletList", listItem(bulletMatch[1]!));
      i++;
      continue;
    }

    if (orderedMatch) {
      pushToList("orderedList", listItem(orderedMatch[1]!));
      i++;
      continue;
    }

    flushList();

    if (quoteMatch) {
      content.push({ type: "blockquote", content: [paragraph(quoteMatch[1]!)] });
      i++;
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    content.push(paragraph(line));
    i++;
  }
  flushList();

  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph", content: [] }] };
}
