import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";
import type { ParsedImportAttachment, ParsedImportItem, ParsedImportResult } from "../types";

/** `jsdom` já é dependência do projeto (usado hoje só pra gerar HTML de item público) — seu `DOMParser`/modo `text/xml` também dá conta de ler `.enex`/ENML sem precisar de uma lib de XML nova. */
function parseXml(xml: string): Document {
  return new JSDOM(xml, { contentType: "text/xml" }).window.document;
}

function enmlDateToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function decodeBase64(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64.replace(/\s+/g, ""), "base64"));
}

function md5Hex(data: Uint8Array): string {
  return createHash("md5").update(data).digest("hex");
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

function extensionForMime(mime: string): string {
  return MIME_EXTENSIONS[mime] ?? "bin";
}

function childrenInline(el: Element, mediaByHash: Map<string, string>): string {
  return Array.from(el.childNodes)
    .map((child) => inlineText(child, mediaByHash))
    .join("");
}

function inlineText(node: ChildNode, mediaByHash: Map<string, string>): string {
  if (node.nodeType === node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== node.ELEMENT_NODE) return "";

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (tag === "br") return "\n";
  if (tag === "en-media") {
    const hash = el.getAttribute("hash") ?? "";
    return `[anexo: ${mediaByHash.get(hash) ?? "arquivo"}]`;
  }
  if (tag === "b" || tag === "strong") return `**${childrenInline(el, mediaByHash)}**`;
  if (tag === "i" || tag === "em") return `*${childrenInline(el, mediaByHash)}*`;
  if (tag === "code" || tag === "tt") return `\`${childrenInline(el, mediaByHash)}\``;
  return childrenInline(el, mediaByHash);
}

/** Um bloco ENML (`<div>`/`<p>`/`<ul>`/`<ol>`) → uma ou mais linhas de Markdown. `<en-todo>` como primeiro filho de um `<div>` (como o Evernote grava checkbox) vira `- [x]`/`- [ ]`. */
function blockToLines(el: Element, mediaByHash: Map<string, string>): string[] {
  const tag = el.tagName.toLowerCase();

  if (tag === "ul" || tag === "ol") {
    const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === "li");
    return items.map((li, i) => `${tag === "ul" ? "-" : `${i + 1}.`} ${childrenInline(li, mediaByHash).trim()}`);
  }

  if (tag === "div" || tag === "p") {
    const firstChild = el.firstElementChild;
    if (firstChild && firstChild.tagName.toLowerCase() === "en-todo") {
      const checked = firstChild.getAttribute("checked") === "true";
      const rest = Array.from(el.childNodes).filter((c) => c !== firstChild);
      const text = rest
        .map((c) => inlineText(c, mediaByHash))
        .join("")
        .trim();
      return [`- [${checked ? "x" : " "}] ${text}`];
    }
    const text = childrenInline(el, mediaByHash).trim();
    return text ? [text] : [];
  }

  const text = childrenInline(el, mediaByHash).trim();
  return text ? [text] : [];
}

/** ENML (o corpo XHTML-like de `<content>`) → Markdown simples — cobre parágrafo/`<br>`, negrito/itálico/código, listas e checkbox (`<en-todo>`); `<en-media>` (foto/anexo embutido) vira um marcador de texto `[anexo: nome]`, o arquivo em si sobe como anexo do item. */
export function enmlToMarkdown(enNote: Element, mediaByHash: Map<string, string>): string {
  const lines: string[] = [];
  for (const child of Array.from(enNote.childNodes)) {
    if (child.nodeType === child.TEXT_NODE) {
      const text = (child.textContent ?? "").trim();
      if (text) lines.push(text);
      continue;
    }
    if (child.nodeType !== child.ELEMENT_NODE) continue;
    lines.push(...blockToLines(child as Element, mediaByHash));
  }
  return lines.join("\n");
}

/**
 * `.enex` (export do Evernote, 7.5) → `ParsedImportItem[]`. Cada `<note>`
 * vira um item; `<resource>` (anexos em base64) sobem como
 * `attachments`, casados com `<en-media hash="...">` no corpo pelo MD5 dos
 * bytes (mesmo hash que o Evernote já usa pra essa referência).
 */
export function parseEnex(xmlText: string): ParsedImportResult {
  const doc = parseXml(xmlText);
  const noteEls = Array.from(doc.getElementsByTagName("note"));
  const items: ParsedImportItem[] = [];
  const warnings: string[] = [];

  noteEls.forEach((noteEl, index) => {
    const title = noteEl.getElementsByTagName("title")[0]?.textContent?.trim() || "Sem título";
    const createdAt = enmlDateToIso(noteEl.getElementsByTagName("created")[0]?.textContent);
    const updatedAt = enmlDateToIso(noteEl.getElementsByTagName("updated")[0]?.textContent) ?? createdAt;
    const tags = Array.from(noteEl.getElementsByTagName("tag"))
      .map((t) => (t.textContent ?? "").trim().toLowerCase())
      .filter(Boolean);

    const attachments: ParsedImportAttachment[] = [];
    const mediaByHash = new Map<string, string>();
    Array.from(noteEl.getElementsByTagName("resource")).forEach((resourceEl, resourceIndex) => {
      const dataEl = resourceEl.getElementsByTagName("data")[0];
      if (!dataEl?.textContent) return;
      const mime = resourceEl.getElementsByTagName("mime")[0]?.textContent?.trim() || "application/octet-stream";
      const bytes = decodeBase64(dataEl.textContent);
      const hash = md5Hex(bytes);
      const fileName = resourceEl.querySelector("resource-attributes > file-name")?.textContent?.trim() || `anexo-${resourceIndex + 1}.${extensionForMime(mime)}`;
      mediaByHash.set(hash, fileName);
      attachments.push({ fileName, mimeType: mime, data: bytes });
    });

    const contentRaw = noteEl.getElementsByTagName("content")[0]?.textContent ?? "";
    let bodyMarkdown = "";
    if (contentRaw.trim()) {
      const enNote = parseXml(contentRaw).getElementsByTagName("en-note")[0];
      if (enNote) bodyMarkdown = enmlToMarkdown(enNote, mediaByHash);
      else warnings.push(`Não consegui interpretar o conteúdo da nota "${title}" — importada sem corpo.`);
    }

    items.push({ localId: `enex-${index}`, title, bodyMarkdown, tags, createdAt, updatedAt, attachments });
  });

  if (noteEls.length === 0) warnings.push("Nenhuma nota encontrada no arquivo .enex.");
  return { items, warnings };
}
