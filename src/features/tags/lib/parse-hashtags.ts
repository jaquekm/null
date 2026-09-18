/** `#palavra` no título/captura (1.8): letras (com acento), números e hífen. */
const HASHTAG_PATTERN = /#([\p{L}\p{N}][\p{L}\p{N}-]*)/gu;

/** Extrai as tags de um texto, normalizadas para minúsculo, sem duplicatas. */
export function parseHashtags(text: string): string[] {
  const tags = new Set<string>();
  for (const match of text.matchAll(HASHTAG_PATTERN)) {
    const tag = match[1]?.toLowerCase();
    if (tag) tags.add(tag);
  }
  return [...tags];
}
