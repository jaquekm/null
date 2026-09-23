import "server-only";
import type { EmbeddingsProvider } from "./types";

const API_URL = "https://api.voyageai.com/v1/embeddings";

interface VoyageResponse {
  data: { embedding: number[]; index: number }[];
}

/**
 * Voyage AI (`docs/decisoes.md`, "Embeddings: Voyage AI") — chamada HTTP
 * direta (sem SDK, a Voyage não tem um pacote oficial JS mantido; API REST
 * simples o bastante, mesmo critério já usado nas outras integrações sem
 * SDK oficial). `input_type` ("document" pra trechos indexados, "query" pra
 * busca) é uma otimização própria da Voyage — embeddings ficam mais
 * comparáveis entre si quando o provedor sabe qual é qual.
 */
export class VoyageEmbeddingsProvider implements EmbeddingsProvider {
  constructor(
    private readonly apiKey: string,
    public readonly model: string,
    public readonly dimensions: number,
  ) {}

  private async embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ input: texts, model: this.model, input_type: inputType, truncation: true }),
    });

    if (!response.ok) {
      throw new Error(`Voyage AI respondeu ${response.status}: ${await response.text()}`);
    }

    const result = (await response.json()) as VoyageResponse;
    return result.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
  }

  embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embed(texts, "document");
  }

  async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.embed([text], "query");
    return embedding!;
  }
}
