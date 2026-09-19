const SUPPORTED_IMAGE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export type AnthropicImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/** A API do Claude só aceita esses 4 formatos de imagem (2.9, OCR) — `null` para qualquer outro `image/*` (ex.: `image/heic`). */
export function toAnthropicImageMediaType(mimeType: string): AnthropicImageMediaType | null {
  return SUPPORTED_IMAGE_MEDIA_TYPES.has(mimeType) ? (mimeType as AnthropicImageMediaType) : null;
}
