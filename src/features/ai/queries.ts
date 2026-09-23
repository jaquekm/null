import "server-only";
import { estimateTokens } from "@/features/ai/lib/chunking";
import { estimateEmbeddingCostUsd } from "@/lib/ai/pricing";
import { getEmbeddingsProvider } from "@/lib/embeddings";
import type { Client } from "./types";

export interface ReindexEstimate {
  itemCount: number;
  estimatedTokens: number;
  estimatedUsd: number | null;
}

/**
 * Estimativa pra "Reindexar tudo" (6.5, `/configuracoes/ia`) — soma bruta do
 * texto indexável de todo item ativo (`content_text`/`extra_text`/`properties`),
 * sem montar os trechos de verdade (isso já é o trabalho do próprio job,
 * caro demais pra rodar só pra estimar). Superestima um pouco (o chunking
 * real tem sobreposição entre trechos), o que é o lado seguro pra uma
 * estimativa de custo.
 */
export async function estimateReindexCost(supabase: Client, ownerId: string): Promise<ReindexEstimate> {
  const { data } = await supabase.from("items").select("id, content_text, extra_text, properties").eq("owner_id", ownerId).is("deleted_at", null);
  const rows = data ?? [];

  const totalChars = rows.reduce((sum, row) => {
    const propertiesText = JSON.stringify(row.properties ?? {});
    return sum + row.content_text.length + row.extra_text.length + propertiesText.length;
  }, 0);

  const estimatedTokens = estimateTokens("a".repeat(totalChars));
  const provider = getEmbeddingsProvider();
  const estimatedUsd = provider ? estimateEmbeddingCostUsd(provider.model, estimatedTokens) : null;

  return { itemCount: rows.length, estimatedTokens, estimatedUsd };
}

/** Ids de todo item ativo do dono — "Reindexar tudo" enfileira `index_item` pra cada um. */
export async function listActiveItemIds(supabase: Client, ownerId: string): Promise<string[]> {
  const { data } = await supabase.from("items").select("id").eq("owner_id", ownerId).is("deleted_at", null);
  return (data ?? []).map((row) => row.id);
}
