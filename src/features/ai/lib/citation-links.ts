import type { AskSource } from "@/features/ai/lib/ask-context";

/**
 * URL do item citado (6.7, passo 7) — abre no trecho/tempo (`?t=`, mesma
 * convenção de `search-result-row.tsx`, 6.6) ou na página (`?page=`, nova
 * pra anexos: sem marcação real de página, `TranscriptViewer`/visualizador de
 * anexo decide o que fazer com ela). Sem `seekSeconds`/`page`, abre o item liso.
 */
export function buildCitationHref(source: Pick<AskSource, "itemId" | "seekSeconds" | "page">): string {
  if (source.seekSeconds != null) return `/itens/${source.itemId}?t=${Math.floor(source.seekSeconds)}`;
  if (source.page != null) return `/itens/${source.itemId}?page=${source.page}`;
  return `/itens/${source.itemId}`;
}

export interface CitationMatch {
  /** Posição de início de `[n]` no texto original. */
  index: number;
  /** Texto completo do marcador, ex.: `"[1]"`. */
  raw: string;
  n: number;
  source: AskSource | null;
}

const CITATION_PATTERN = /\[(\d+)\]/g;

/**
 * Encontra cada marcador `[n]` na resposta do modelo e resolve pra fonte
 * correspondente (6.7, passo 7: "mapear [n] para links clicáveis"). `source`
 * vem `null` quando o modelo cita um número fora da lista (alucinação) —
 * quem renderiza decide se ignora ou mostra sem link.
 */
export function findCitationMatches(text: string, sources: AskSource[]): CitationMatch[] {
  const sourceByN = new Map(sources.map((source) => [source.n, source]));
  const matches: CitationMatch[] = [];

  for (const match of text.matchAll(CITATION_PATTERN)) {
    const n = Number(match[1]);
    matches.push({ index: match.index, raw: match[0], n, source: sourceByN.get(n) ?? null });
  }

  return matches;
}
