export interface HybridChunkRow {
  item_id: string;
  title: string;
  content: string;
  metadata: unknown;
  score: number;
}

export interface GroupedHybridResult {
  itemId: string;
  title: string;
  content: string;
  metadata: unknown;
}

/**
 * "Agrupar trechos por item (melhor score)" (6.6) — `hybrid_search` já
 * devolve os trechos ordenados por `score` decrescente, então o primeiro
 * trecho de cada `item_id` encontrado já é o de maior score daquele item;
 * não precisa comparar nem reordenar depois, só manter a primeira ocorrência.
 */
export function groupHybridResultsByItem(rows: HybridChunkRow[], limit: number): GroupedHybridResult[] {
  const seen = new Set<string>();
  const grouped: GroupedHybridResult[] = [];

  for (const row of rows) {
    if (seen.has(row.item_id)) continue;
    seen.add(row.item_id);
    grouped.push({ itemId: row.item_id, title: row.title, content: row.content, metadata: row.metadata });
    if (grouped.length >= limit) break;
  }

  return grouped;
}

/** `metadata.start` só existe em trechos de transcrição (`chunkTranscript`, 6.5) — sinal seguro de "este é o trecho certo pro botão Ouvir a partir de X". */
export function extractSeekSeconds(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const start = (metadata as Record<string, unknown>).start;
  return typeof start === "number" ? start : null;
}
