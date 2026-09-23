/**
 * Similaridade de cosseno entre dois embeddings (6.7: ranquear trechos de um
 * escopo fixo de itens contra o embedding da pergunta, sem RPC — `hybrid_search`
 * só aceita `p_space_ids`/`p_type_ids`, não uma lista arbitrária de item ids).
 * Assume os dois vetores com a mesma dimensão (mesmo `embedding_model`).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
