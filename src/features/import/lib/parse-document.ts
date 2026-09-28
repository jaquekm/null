import type { JSONContent } from "@tiptap/core";
import mammoth from "mammoth";
import type { ParsedImportItem, ParsedImportResult } from "../types";
import { htmlToTiptapDoc } from "./html-to-tiptap";

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const BACKSLASH_PLACEHOLDER = "\u0000BACKSLASH\u0000";

function titleFromFileName(fileName: string): string {
  const base = fileName.split("/").pop() ?? fileName;
  const withoutExtension = base.replace(/\.docx$/i, "").trim();
  return withoutExtension || "Sem título";
}

/**
 * `mammoth.convertToMarkdown` (`markdown-writer.js` do pacote) escapa toda
 * pontuação com significado em Markdown — mesmo quando não faria falta,
 * então uma frase comum já sai cheia de `\.`/`\-` — e usa `__negrito__`
 * (dois underscores) mais uma âncora `<a id="...">` antes de cada título,
 * pensada pra navegação dentro do Word/HTML. Nosso conversor de Markdown
 * pra Tiptap (`markdown-to-tiptap.ts`) só entende `**negrito**` e não sabe
 * nada de HTML — sem esta limpeza, o item importado viria com barras
 * invertidas soltas no meio do texto e tags `<a>` visíveis nos títulos.
 */
export function sanitizeMammothMarkdown(markdown: string): string {
  return markdown
    .replace(/<a id="[^"]*"><\/a>/g, "")
    .replace(/\\\\/g, BACKSLASH_PLACEHOLDER)
    .replace(/\\([`*_{}[\]()#+\-.!])/g, "$1")
    .replaceAll(BACKSLASH_PLACEHOLDER, "\\")
    .replace(/__([^_]+)__/g, "**$1**");
}

/** Descarta imagens embutidas (só conta, pra avisar) em vez de viraram base64 gigante no corpo. */
function discardImages(onImage: () => void) {
  return mammoth.images.imgElement(() => {
    onImage();
    return {};
  });
}

/**
 * `.docx` → documento do editor preservando títulos, listas, negrito,
 * links e **tabelas** (via HTML). O Markdown do mammoth não tem tabela:
 * cada célula virava um parágrafo solto.
 */
export async function docxToTiptapDoc(buffer: Buffer): Promise<{ doc: JSONContent; imageCount: number }> {
  let imageCount = 0;
  const converted = await mammoth.convertToHtml({ buffer }, { convertImage: discardImages(() => imageCount++) });
  return { doc: htmlToTiptapDoc(converted.value), imageCount };
}

function buildDocumentImportItem(
  fileName: string,
  rawMarkdown: string,
  imageCount: number,
  bodyDoc?: JSONContent,
): { item: ParsedImportItem | null; warnings: string[] } {
  const bodyMarkdown = sanitizeMammothMarkdown(rawMarkdown).trim();
  const warnings: string[] = [];
  if (imageCount > 0) warnings.push(`${imageCount} imagem(ns) do documento não foram importadas — só o texto vira item.`);
  if (!bodyMarkdown) {
    warnings.push("O documento está vazio.");
    return { item: null, warnings };
  }

  const tags = [...new Set([...bodyMarkdown.matchAll(/(?:^|\s)#([a-zA-Z0-9_/-]+)/g)].map((m) => m[1]!.toLowerCase()))];

  return {
    item: { localId: "documento-0", title: titleFromFileName(fileName), bodyMarkdown, bodyDoc, tags, createdAt: null, updatedAt: null, attachments: [] },
    warnings,
  };
}

/**
 * Origem "Documento" do assistente de importação (7.5+): um `.docx` do Word
 * → um único `ParsedImportItem` editável, com o texto do arquivo. Diferente
 * de Evernote/Obsidian/Keep, aqui sempre é 1 arquivo = 1 item — não existe
 * "várias notas dentro do mesmo `.docx`". Imagens embutidas são descartadas
 * (só contadas, pra um aviso) em vez de viraram base64 gigante dentro do
 * corpo do item.
 */
export async function parseDocumentFile(file: File): Promise<ParsedImportResult> {
  if (file.type !== DOCX_MIME_TYPE && !file.name.toLowerCase().endsWith(".docx")) {
    return { items: [], warnings: ["Só arquivos .docx são aceitos nesta origem."] };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Markdown continua servindo à busca/pré-visualização; o corpo do item vem do HTML (tabelas preservadas).
  const converted = await mammoth.convertToMarkdown({ buffer }, { convertImage: discardImages(() => {}) });
  const { doc, imageCount } = await docxToTiptapDoc(buffer);

  const { item, warnings } = buildDocumentImportItem(file.name, converted.value, imageCount, doc);
  return { items: item ? [item] : [], warnings };
}
