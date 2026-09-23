import { describeChunkLocation, extractPage, extractSeekSeconds } from "@/features/ai/lib/chunk-metadata";
import { estimateTokens } from "@/features/ai/lib/chunking";

export interface RetrievedChunk {
  chunkId: string;
  itemId: string;
  title: string;
  content: string;
  metadata: unknown;
  score: number;
}

export interface ItemLabel {
  title: string;
  typeName: string | null;
  spaceName: string | null;
}

export interface AskSource {
  n: number;
  chunkId: string;
  itemId: string;
  title: string;
  excerpt: string;
  /** "trecho 00:14:20" / "página 4" / "" — rótulo pra exibir na citação. */
  location: string;
  /** Segundos, quando `location` vem de uma transcrição — pro link abrir `/itens/{id}?t=`. */
  seekSeconds: number | null;
  /** Página, quando `location` vem de um anexo — pro link abrir `/itens/{id}?page=`. */
  page: number | null;
}

export interface AskContext {
  /** Vazio quando não sobrou nenhum trecho (sem fontes — o system prompt trata isso). */
  contextText: string;
  sources: AskSource[];
}

export const CONTEXT_TOKEN_BUDGET = 12000;
export const MAX_CHUNKS_PER_ITEM = 4;

/**
 * Escolhe os trechos que cabem no orçamento de contexto (6.7, passo 3):
 * `chunks` já vem ordenado por score decrescente (`hybrid_search`), então
 * percorrer na ordem e ir somando já prioriza score. Diversidade por item
 * (máx. `maxPerItem`) é um limite por item, não um reordenamento. Um trecho
 * que estourar o orçamento é pulado (não interrompe o laço) pra deixar
 * trechos menores, mais adiante na lista, ainda caberem.
 */
export function selectChunksWithinBudget(
  chunks: RetrievedChunk[],
  budgetTokens: number = CONTEXT_TOKEN_BUDGET,
  maxPerItem: number = MAX_CHUNKS_PER_ITEM,
): RetrievedChunk[] {
  const perItemCount = new Map<string, number>();
  const selected: RetrievedChunk[] = [];
  let usedTokens = 0;

  for (const chunk of chunks) {
    const count = perItemCount.get(chunk.itemId) ?? 0;
    if (count >= maxPerItem) continue;

    const tokens = estimateTokens(chunk.content);
    if (usedTokens + tokens > budgetTokens) continue;

    selected.push(chunk);
    perItemCount.set(chunk.itemId, count + 1);
    usedTokens += tokens;
  }

  return selected;
}

function formatSourceHeader(n: number, chunk: RetrievedChunk, label: ItemLabel | undefined): string {
  const title = label?.title ?? chunk.title;
  const typeAndSpace = [label?.typeName, label?.spaceName ? `espaço ${label.spaceName}` : null].filter(Boolean).join(", ");
  const location = describeChunkLocation(chunk.metadata);

  let header = `[${n}] Item: "${title}"`;
  if (typeAndSpace) header += ` (${typeAndSpace})`;
  if (location) header += ` — ${location}`;
  return header;
}

const EXCERPT_LENGTH = 240;

/**
 * Monta o contexto numerado (6.7, passo 4) a partir dos trechos já
 * selecionados (`selectChunksWithinBudget`) e dos rótulos de item (tipo/espaço,
 * buscados à parte — `hybrid_search` não devolve isso). `sources` é o que vira
 * `ai_messages.citations` depois de mapear `[n]` na resposta (passo 7).
 */
export function buildAskContext(chunks: RetrievedChunk[], itemLabels: Map<string, ItemLabel>): AskContext {
  const blocks: string[] = [];
  const sources: AskSource[] = [];

  chunks.forEach((chunk, index) => {
    const n = index + 1;
    const label = itemLabels.get(chunk.itemId);
    blocks.push(`${formatSourceHeader(n, chunk, label)}\n${chunk.content}`);
    sources.push({
      n,
      chunkId: chunk.chunkId,
      itemId: chunk.itemId,
      title: label?.title ?? chunk.title,
      excerpt: chunk.content.length > EXCERPT_LENGTH ? `${chunk.content.slice(0, EXCERPT_LENGTH)}…` : chunk.content,
      location: describeChunkLocation(chunk.metadata),
      seekSeconds: extractSeekSeconds(chunk.metadata),
      page: extractPage(chunk.metadata),
    });
  });

  return { contextText: blocks.join("\n\n"), sources };
}
