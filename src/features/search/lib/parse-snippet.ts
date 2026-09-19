export interface SnippetSegment {
  text: string;
  marked: boolean;
}

const MARK_OPEN = "<mark>";
const MARK_CLOSE = "</mark>";

/**
 * Separa o `snippet` de `ts_headline` (1.14) em segmentos de texto simples,
 * sem nunca interpretar a string como HTML — evita `dangerouslySetInnerHTML`
 * (o enunciado pede "renderizar com sanitização, permitindo só mark"; aqui
 * não existe HTML nenhum pra sanitizar, o React escapa tudo que não é
 * explicitamente marcado como destacado).
 */
export function parseSnippet(snippet: string): SnippetSegment[] {
  const segments: SnippetSegment[] = [];
  let marked = false;
  let rest = snippet;

  while (rest.length > 0) {
    const nextTag = marked ? MARK_CLOSE : MARK_OPEN;
    const index = rest.indexOf(nextTag);
    if (index === -1) {
      segments.push({ text: rest, marked });
      break;
    }
    if (index > 0) segments.push({ text: rest.slice(0, index), marked });
    rest = rest.slice(index + nextTag.length);
    marked = !marked;
  }

  return segments.filter((segment) => segment.text.length > 0);
}
