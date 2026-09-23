import { createHash } from "node:crypto";
import type { JSONContent } from "@tiptap/core";
import { chunkText } from "@/features/transcripts/lib/chunk-text";
import { formatTimestamp } from "@/features/transcripts/lib/format-timestamp";
import type { FieldDefinition } from "@/features/types/schemas";
import type { Segment } from "@/lib/transcription/types";

/** Alvo de ~500 tokens por trecho (estimativa caracteres ÷ 4, enunciado da 6.5) e ~60 de sobreposição. */
const TARGET_CHARS = 2000;
const OVERLAP_CHARS = 240;
/** "Janelas de ~2-3 minutos" pro agrupamento de segmentos de transcrição — o meio do intervalo pedido. */
const TRANSCRIPT_WINDOW_SECONDS = 150;

export interface ChunkDraft {
  /** Texto final do trecho, já com prefixo/formatação — o que vai pra `item_chunks.content` e pro embedding. */
  text: string;
  metadata: Record<string, unknown>;
}

/** `token_estimate` (6.5: "estimativa: caracteres ÷ 4") — mesmo critério em todo o pipeline de chunking. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** `content_hash` = sha256 do texto do trecho (6.5) — usado pra reaproveitar embeddings de trechos inalterados. */
export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

const LINE_BREAKING_TYPES = new Set(["paragraph", "heading", "codeBlock"]);

interface ContentLine {
  isHeading: boolean;
  text: string;
}

/** Mesmo `walk` de `features/items/lib/extract-text.ts`, mas preservando se cada linha veio de um `heading` — pra saber onde uma seção começa. */
function extractContentLines(doc: JSONContent | null): ContentLine[] {
  if (!doc) return [];

  const lines: ContentLine[] = [];
  let current = "";
  let currentIsHeading = false;

  function walk(node: JSONContent) {
    if (typeof node.text === "string") current += node.text;
    for (const child of node.content ?? []) walk(child);
    if (node.type && LINE_BREAKING_TYPES.has(node.type)) {
      currentIsHeading = node.type === "heading";
      if (current.trim()) lines.push({ isHeading: currentIsHeading, text: current });
      current = "";
    }
  }

  for (const child of doc.content ?? []) walk(child);
  if (current.trim()) lines.push({ isHeading: currentIsHeading, text: current });

  return lines;
}

interface ContentSection {
  title: string | null;
  lines: string[];
}

function groupIntoSections(lines: ContentLine[]): ContentSection[] {
  const sections: ContentSection[] = [{ title: null, lines: [] }];

  for (const line of lines) {
    if (line.isHeading) {
      sections.push({ title: line.text, lines: [] });
    } else {
      sections[sections.length - 1]!.lines.push(line.text);
    }
  }

  return sections.filter((section) => section.lines.length > 0);
}

/**
 * Divide o conteúdo (Tiptap) de um item em trechos (6.5): por título/seção
 * primeiro, depois cada seção em blocos de ~500 tokens com ~60 de
 * sobreposição (`chunkText`, já usada pro resumo de transcrições longas,
 * 2.7 — mesma técnica, char-based, prefere quebrar em `\n`). Cada trecho
 * prefixado com `Título do item › Seção` (ou só `Título do item`, sem
 * seção, pro conteúdo antes do primeiro heading).
 */
export function chunkItemContent(itemTitle: string, content: JSONContent | null): ChunkDraft[] {
  const sections = groupIntoSections(extractContentLines(content));
  const chunks: ChunkDraft[] = [];

  for (const section of sections) {
    const prefix = section.title ? `${itemTitle} › ${section.title}` : itemTitle;
    const joined = section.lines.join("\n");

    for (const piece of chunkText(joined, TARGET_CHARS, OVERLAP_CHARS)) {
      if (!piece.trim()) continue;
      chunks.push({ text: `${prefix}\n\n${piece}`, metadata: { title: itemTitle, section: section.title } });
    }
  }

  return chunks;
}

/**
 * Agrupa segmentos de transcrição em janelas de ~2-3 min (6.5), com
 * locutores resolvidos (`speaker_names`) e timestamp — mesmo formato de
 * linha de `buildTranscriptText` (2.7): `[HH:MM:SS] Nome: texto`.
 * `metadata.start` é o início da janela, em segundos.
 */
export function chunkTranscript(segments: Segment[], speakerNames: Record<string, string>): ChunkDraft[] {
  if (segments.length === 0) return [];

  const chunks: ChunkDraft[] = [];
  let windowStart = segments[0]!.start;
  let lines: string[] = [];

  function flush() {
    if (lines.length === 0) return;
    chunks.push({ text: lines.join("\n"), metadata: { start: windowStart } });
    lines = [];
  }

  for (const segment of segments) {
    if (segment.start - windowStart >= TRANSCRIPT_WINDOW_SECONDS && lines.length > 0) {
      flush();
      windowStart = segment.start;
    }
    const name = speakerNames[segment.speaker] ?? segment.speaker;
    lines.push(`[${formatTimestamp(segment.start)}] ${name}: ${segment.text}`);
  }
  flush();

  return chunks;
}

/**
 * Trechos de um anexo (6.5): "por página quando houver `page_count`" — como
 * a extração hoje (`extract-attachment.ts`, 2.9) sempre mescla o texto num
 * corrido só (sem marcação de página real), a divisão por página é uma
 * heurística: o texto corrido é fatiado em `pageCount` partes de tamanho
 * aproximadamente igual. Sem `pageCount` (ou só 1 página), cai no chunking
 * genérico por tamanho, igual ao conteúdo de item.
 */
export function chunkAttachmentText(text: string, pageCount: number | null): ChunkDraft[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (pageCount && pageCount > 1) {
    const perPage = Math.ceil(trimmed.length / pageCount);
    const chunks: ChunkDraft[] = [];
    for (let page = 0; page < pageCount; page++) {
      const slice = trimmed.slice(page * perPage, (page + 1) * perPage).trim();
      if (slice) chunks.push({ text: slice, metadata: { page: page + 1 } });
    }
    return chunks;
  }

  return chunkText(trimmed, TARGET_CHARS, OVERLAP_CHARS)
    .filter((piece) => piece.trim())
    .map((piece) => ({ text: piece, metadata: {} }));
}

export interface PropertyResolutionMaps {
  /** `contactId -> nome` (campos `contact`), carregado em lote por quem chama (mesmo padrão de `loadContactNames`, `reports/generators/custom.ts`). */
  contactNames: Map<string, string>;
  /** `itemId -> título` (campos `relation`). */
  itemTitles: Map<string, string>;
}

function formatFieldValue(field: FieldDefinition, raw: unknown, maps: PropertyResolutionMaps): string | null {
  if (field.type === "select") {
    const option = field.options?.find((o) => o.id === raw);
    return option?.label ?? String(raw);
  }
  if (field.type === "multi_select") {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const labels = raw.map((id) => field.options?.find((o) => o.id === id)?.label ?? String(id));
    return labels.join(", ");
  }
  if (field.type === "contact") {
    const ids = Array.isArray(raw) ? raw : [raw];
    const names = ids.map((id) => maps.contactNames.get(String(id)) ?? String(id));
    return names.join(", ");
  }
  if (field.type === "relation") {
    const ids = Array.isArray(raw) ? raw : [raw];
    const titles = ids.map((id) => maps.itemTitles.get(String(id)) ?? String(id));
    return titles.join(", ");
  }
  if (field.type === "checkbox") return raw ? "Sim" : "Não";
  if (field.type === "file") return null; // não é texto legível — sem valor pra indexar

  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return null;
}

/**
 * Um único trecho com "Campo: valor" legível por propriedade preenchida
 * (6.5) — resolve `select`/`multi_select` pro rótulo e `relation`/`contact`
 * pro nome, usando os mapas já carregados em lote (`maps`, evita 1 consulta
 * por campo). `includeFinanceContacts=false` (padrão) pula campos `contact`
 * e `money` — contrato de privacidade da página `/configuracoes/ia`
 * (CLAUDE.md: "nada de dados financeiros ou de contatos é enviado à IA sem
 * o módulo estar habilitado"), ver `docs/decisoes.md`.
 */
export function chunkProperties(
  fields: FieldDefinition[],
  properties: Record<string, unknown>,
  maps: PropertyResolutionMaps,
  options: { includeFinanceContacts: boolean },
): ChunkDraft | null {
  const lines: string[] = [];

  for (const field of fields) {
    if (field.hidden) continue;
    if (!options.includeFinanceContacts && (field.type === "contact" || field.type === "money")) continue;

    const raw = properties[field.key];
    if (raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0)) continue;

    const value = formatFieldValue(field, raw, maps);
    if (value) lines.push(`${field.label}: ${value}`);
  }

  if (lines.length === 0) return null;
  return { text: lines.join("\n"), metadata: {} };
}
