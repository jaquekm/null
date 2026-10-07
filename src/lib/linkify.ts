/**
 * Quebra um texto em pedaços, marcando os links (http/https e "www.") pra
 * virarem clicáveis — usado nos detalhes dos itens de lista (07/10), onde a
 * dona cola o link do lugar/presente/filme.
 */
export interface TextPart {
  text: string;
  /** Presente quando o pedaço é um link. */
  href?: string;
}

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    let url = match[0];
    const trailing = TRAILING_PUNCTUATION.exec(url)?.[0] ?? "";
    if (trailing) url = url.slice(0, -trailing.length);
    const start = match.index;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: url, href: url.toLowerCase().startsWith("www.") ? `https://${url}` : url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
