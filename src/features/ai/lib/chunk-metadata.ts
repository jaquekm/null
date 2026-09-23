import { formatTimestamp } from "@/features/transcripts/lib/format-timestamp";

/** `metadata.start` só existe em trechos de transcrição (`chunkTranscript`, 6.5). */
export function extractSeekSeconds(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const start = (metadata as Record<string, unknown>).start;
  return typeof start === "number" ? start : null;
}

/** `metadata.page` só existe em trechos de anexo com mais de uma página (`chunkAttachmentText`, 6.5). */
export function extractPage(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const page = (metadata as Record<string, unknown>).page;
  return typeof page === "number" ? page : null;
}

/** `metadata.section` só existe em trechos de conteúdo de item, quando há um título de seção (`chunkItemContent`, 6.5). */
function extractSection(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const section = (metadata as Record<string, unknown>).section;
  return typeof section === "string" ? section : null;
}

/** Rótulo curto de onde um trecho vem, pro contexto numerado (6.7: "[1] Item: ... — trecho 00:14:20") — vazio quando não há nada específico a apontar (propriedades). */
export function describeChunkLocation(metadata: unknown): string {
  const seekSeconds = extractSeekSeconds(metadata);
  if (seekSeconds != null) return `trecho ${formatTimestamp(seekSeconds)}`;

  const page = extractPage(metadata);
  if (page != null) return `página ${page}`;

  const section = extractSection(metadata);
  if (section) return `seção "${section}"`;

  return "";
}
