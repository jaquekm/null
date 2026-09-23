import "server-only";
import { serverEnv } from "@/lib/env";
import { VoyageEmbeddingsProvider } from "./voyage";
import type { EmbeddingsProvider } from "./types";

let cached: EmbeddingsProvider | null | undefined;

function buildProvider(): EmbeddingsProvider | null {
  if (serverEnv.EMBEDDINGS_PROVIDER !== "voyage" || !serverEnv.EMBEDDINGS_API_KEY || !serverEnv.EMBEDDINGS_MODEL || !serverEnv.EMBEDDINGS_DIM) {
    return null;
  }
  return new VoyageEmbeddingsProvider(serverEnv.EMBEDDINGS_API_KEY, serverEnv.EMBEDDINGS_MODEL, serverEnv.EMBEDDINGS_DIM);
}

/**
 * Escolhe a implementação de `EmbeddingsProvider` por variável de ambiente
 * (6.5, mesmo padrão de `getMessageChannel`/`getTranscriptionProvider`) —
 * sem as chaves configuradas, `null` (index_item pula a indexação). Uma
 * instância só, cacheada na primeira leitura.
 */
export function getEmbeddingsProvider(): EmbeddingsProvider | null {
  if (cached === undefined) cached = buildProvider();
  return cached;
}

export type { EmbeddingsProvider } from "./types";
