import type { JSONContent } from "@tiptap/core";

/**
 * Inverso de `markdown-to-tiptap.ts` — usado pelo `get_item` do servidor MCP
 * (6.9, "conteúdo em Markdown") e por `append_to_item` pra devolver o texto
 * atual do item a um cliente MCP. Cobre o mesmo subconjunto reversível que
 * `markdownToTiptapDoc` (parágrafo, `heading` 1-3, `bulletList`/`orderedList`/
 * `taskList`, `blockquote`, tabela, marcas `bold`/`italic`/`code`) — qualquer
 * atalho novo precisa ser adicionado nos dois sentidos. Blocos fora desse
 * subconjunto (`codeBlock`, `image`, `details`, `highlight`) são só de
 * leitura aqui: viram texto simples ou uma aproximação em Markdown, sem
 * round-trip garantido (mesma limitação que `markdownToTiptapDoc` já tem
 * hoje só na direção contrária). `mention`/`contactMention` (menções de item
 * e de contato, 1.7/3.3) viram `[[label]]` — wikilink estilo Obsidian,
 * usado também pelo export completo (7.4).
 */

function markText(text: string, marks: JSONContent["marks"]): string {
  if (!marks || marks.length === 0) return text;
  const types = new Set(marks.map((m) => m.type));
  let out = text;
  if (types.has("code")) out = `\`${out}\``;
  if (types.has("bold")) out = `**${out}**`;
  if (types.has("italic")) out = `*${out}*`;
  return out;
}

function inlineText(nodes: JSONContent[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      if (node.type === "text") return markText(node.text ?? "", node.marks);
      if (node.type === "hardBreak") return "\n";
      if (node.type === "mention" || node.type === "contactMention") {
        const label = typeof node.attrs?.label === "string" ? node.attrs.label : "";
        return label ? `[[${label}]]` : "";
      }
      // Nó inline sem representação em Markdown — cai pro texto puro dos filhos.
      return inlineText(node.content);
    })
    .join("");
}

function renderListItem(item: JSONContent): string {
  // `markdownToTiptapDoc` só gera um `paragraph` por `listItem`/`taskItem` — mantém a mesma forma na volta.
  const paragraph = item.content?.find((c) => c.type === "paragraph");
  return inlineText(paragraph?.content);
}

function renderTableRow(row: JSONContent): string {
  const cells = (row.content ?? []).map((cell) => {
    const paragraph = cell.content?.find((c) => c.type === "paragraph");
    return inlineText(paragraph?.content).replace(/\|/g, "\\|");
  });
  return `| ${cells.join(" | ")} |`;
}

function renderBlock(node: JSONContent): string[] {
  switch (node.type) {
    case "paragraph": {
      const text = inlineText(node.content);
      return [text];
    }
    case "heading": {
      const level = (node.attrs?.level as number | undefined) ?? 1;
      return [`${"#".repeat(Math.min(Math.max(level, 1), 3))} ${inlineText(node.content)}`];
    }
    case "blockquote": {
      const lines = (node.content ?? []).flatMap((child) => renderBlock(child));
      return lines.map((line) => `> ${line}`.trimEnd());
    }
    case "bulletList":
      return (node.content ?? []).map((item) => `- ${renderListItem(item)}`);
    case "orderedList":
      return (node.content ?? []).map((item, index) => `${index + 1}. ${renderListItem(item)}`);
    case "taskList":
      return (node.content ?? []).map((item) => `- [${item.attrs?.checked ? "x" : " "}] ${renderListItem(item)}`);
    case "table": {
      const rows = node.content ?? [];
      const [header, ...body] = rows;
      if (!header) return [];
      const separator = `| ${(header.content ?? []).map(() => "---").join(" | ")} |`;
      return [renderTableRow(header), separator, ...body.map((row) => renderTableRow(row))];
    }
    case "codeBlock": {
      const language = (node.attrs?.language as string | null) ?? "";
      const text = (node.content ?? []).map((child) => child.text ?? "").join("");
      return ["```" + language, ...text.split("\n"), "```"];
    }
    case "image": {
      const alt = (node.attrs?.alt as string | undefined) ?? "imagem";
      return [`![${alt}]`];
    }
    case "detailsSummary":
    case "detailsContent":
    case "details": {
      const lines = (node.content ?? []).flatMap((child) => renderBlock(child));
      return lines;
    }
    default: {
      const text = inlineText(node.content);
      return text ? [text] : [];
    }
  }
}

/** Converte o `JSONContent` do Tiptap em Markdown — usado por `get_item` (6.9). */
export function tiptapDocToMarkdown(doc: JSONContent | null): string {
  if (!doc?.content) return "";

  const blocks = doc.content.map((node) => renderBlock(node).join("\n")).filter((block) => block.trim() !== "");
  return blocks.join("\n\n");
}
