import type { JSONContent } from "@tiptap/core";
import { JSDOM } from "jsdom";

type Mark = { type: string; attrs?: Record<string, unknown> };

const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "TABLE", "BLOCKQUOTE", "PRE", "HR", "DIV"]);

function inlineContent(node: Node, marks: Mark[] = []): JSONContent[] {
  const out: JSONContent[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      const text = (child.textContent ?? "").replace(/\s+/g, " ");
      if (text) out.push(marks.length ? { type: "text", text, marks } : { type: "text", text });
      return;
    }
    if (child.nodeType !== 1) return;
    const el = child as Element;
    const tag = el.tagName;
    if (tag === "BR") {
      out.push({ type: "hardBreak" });
      return;
    }
    if (tag === "IMG") return; // imagens embutidas do Word não viram base64 no corpo
    let nextMarks = marks;
    if (tag === "STRONG" || tag === "B") nextMarks = [...marks, { type: "bold" }];
    else if (tag === "EM" || tag === "I") nextMarks = [...marks, { type: "italic" }];
    else if (tag === "U") nextMarks = [...marks, { type: "underline" }];
    else if (tag === "S" || tag === "DEL" || tag === "STRIKE") nextMarks = [...marks, { type: "strike" }];
    else if (tag === "CODE") nextMarks = [...marks, { type: "code" }];
    else if (tag === "A") {
      const href = el.getAttribute("href") ?? "";
      // Âncoras internas do Word (`<a id="_Toc...">`, `href="#..."`) não levam a lugar nenhum aqui.
      if (href && !href.startsWith("#")) nextMarks = [...marks, { type: "link", attrs: { href } }];
    }
    out.push(...inlineContent(el, nextMarks));
  });
  return trimEdges(out);
}

/** Tira espaço sobrando no começo/fim do parágrafo (o HTML do Word vem com quebras de linha entre as tags). */
function trimEdges(nodes: JSONContent[]): JSONContent[] {
  const first = nodes[0];
  if (first?.type === "text" && first.text) first.text = first.text.replace(/^\s+/, "");
  const last = nodes[nodes.length - 1];
  if (last?.type === "text" && last.text) last.text = last.text.replace(/\s+$/, "");
  return nodes.filter((n) => n.type !== "text" || (n.text ?? "") !== "");
}

function paragraph(content: JSONContent[]): JSONContent {
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

function hasBlockChildren(el: Element): boolean {
  return Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName));
}

/** Conteúdo de uma célula/item de lista: blocos se houver, senão um parágrafo com o texto inline. */
function containerContent(el: Element): JSONContent[] {
  if (hasBlockChildren(el)) {
    const blocks = blockContent(el);
    return blocks.length ? blocks : [paragraph([])];
  }
  return [paragraph(inlineContent(el))];
}

function listNode(el: Element): JSONContent {
  const items = Array.from(el.children)
    .filter((c) => c.tagName === "LI")
    .map((li) => ({ type: "listItem", content: containerContent(li) }));
  return { type: el.tagName === "OL" ? "orderedList" : "bulletList", content: items.length ? items : [{ type: "listItem", content: [paragraph([])] }] };
}

function tableNode(el: Element): JSONContent | null {
  const rows = Array.from(el.querySelectorAll("tr")).filter((tr) => tr.closest("table") === el);
  if (rows.length === 0) return null;
  // O Word raramente marca `<th>`; a primeira linha quase sempre é o cabeçalho (ex.: "Nível | O que é | O que fazer").
  const firstRowHasTh = Array.from(rows[0]!.children).some((c) => c.tagName === "TH");
  const content = rows.map((tr, rowIndex) => ({
    type: "tableRow",
    content: Array.from(tr.children)
      .filter((c) => c.tagName === "TD" || c.tagName === "TH")
      .map((cell) => {
        const isHeader = cell.tagName === "TH" || (rowIndex === 0 && (firstRowHasTh || rows.length > 1));
        const attrs: Record<string, number> = {};
        const colspan = Number(cell.getAttribute("colspan") ?? 1);
        const rowspan = Number(cell.getAttribute("rowspan") ?? 1);
        if (colspan > 1) attrs.colspan = colspan;
        if (rowspan > 1) attrs.rowspan = rowspan;
        return { type: isHeader ? "tableHeader" : "tableCell", ...(Object.keys(attrs).length ? { attrs } : {}), content: containerContent(cell) };
      }),
  }));
  return { type: "table", content: content.filter((row) => row.content.length > 0) };
}

function blockContent(root: Element): JSONContent[] {
  const blocks: JSONContent[] = [];
  let pendingInline: ChildNode[] = [];

  const flushInline = () => {
    if (pendingInline.length === 0) return;
    const holder = root.ownerDocument.createElement("p");
    pendingInline.forEach((n) => holder.appendChild(n.cloneNode(true)));
    const content = inlineContent(holder);
    if (content.length) blocks.push(paragraph(content));
    pendingInline = [];
  };

  root.childNodes.forEach((child) => {
    if (child.nodeType !== 1) {
      if (child.nodeType === 3 && (child.textContent ?? "").trim()) pendingInline.push(child);
      return;
    }
    const el = child as Element;
    const tag = el.tagName;
    if (!BLOCK_TAGS.has(tag)) {
      pendingInline.push(child);
      return;
    }
    flushInline();

    if (/^H[1-6]$/.test(tag)) {
      const content = inlineContent(el);
      if (content.length) blocks.push({ type: "heading", attrs: { level: Math.min(Number(tag[1]), 3) }, content });
    } else if (tag === "P") {
      const content = inlineContent(el);
      if (content.length) blocks.push(paragraph(content));
    } else if (tag === "UL" || tag === "OL") {
      blocks.push(listNode(el));
    } else if (tag === "TABLE") {
      const table = tableNode(el);
      if (table) blocks.push(table);
    } else if (tag === "BLOCKQUOTE") {
      blocks.push({ type: "blockquote", content: containerContent(el) });
    } else if (tag === "PRE") {
      const text = el.textContent ?? "";
      blocks.push(text ? { type: "codeBlock", content: [{ type: "text", text }] } : { type: "codeBlock" });
    } else if (tag === "HR") {
      blocks.push({ type: "horizontalRule" });
    } else if (tag === "DIV") {
      blocks.push(...blockContent(el));
    }
  });
  flushInline();
  return blocks;
}

/**
 * HTML (ex.: saída do `mammoth.convertToHtml` de um `.docx`) → documento
 * Tiptap. Existe porque o caminho antigo (docx → Markdown → Tiptap) perdia
 * as tabelas do Word: cada célula virava um parágrafo solto, e uma tabela
 * "Nível | O que é | O que fazer" chegava como uma lista caótica de linhas.
 * Aqui títulos, listas, negrito/itálico, links e tabelas (com cabeçalho)
 * chegam como os mesmos blocos que o editor cria à mão.
 */
export function htmlToTiptapDoc(html: string): JSONContent {
  const { document } = new JSDOM(`<body>${html}</body>`).window;
  const content = blockContent(document.body);
  return { type: "doc", content: content.length ? content : [paragraph([])] };
}
