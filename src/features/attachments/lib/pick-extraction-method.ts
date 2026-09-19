export type ExtractionStrategy = "plain" | "docx" | "pdf" | "image";

const PLAIN_MIME_TYPES = new Set(["text/plain", "text/markdown", "text/csv"]);
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Estratégia de extração de texto pra este MIME (2.9) — `null` quando o
 * anexo não é elegível (o job `extract_attachment` só é enfileirado quando
 * isto não devolve `null`).
 */
export function pickExtractionStrategy(mimeType: string): ExtractionStrategy | null {
  if (PLAIN_MIME_TYPES.has(mimeType)) return "plain";
  if (mimeType === DOCX_MIME_TYPE) return "docx";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  return null;
}
