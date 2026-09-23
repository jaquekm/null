/**
 * Provedor de embeddings (6.5) atrás de interface (CLAUDE.md: "provedores
 * externos ficam atrás de uma interface, com implementação trocável por
 * variável de ambiente") — mesmo padrão de `MessageChannel`/transcrição.
 * `embedDocuments` (lote, trechos a indexar) e `embedQuery` (busca) usam o
 * mesmo modelo mas podem pedir otimizações diferentes ao provedor (Voyage
 * AI, por exemplo, tem `input_type: "document" | "query"`).
 */
export interface EmbeddingsProvider {
  model: string;
  dimensions: number;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}
