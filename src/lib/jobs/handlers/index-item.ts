import { z } from "zod";
import {
  chunkAttachmentText,
  chunkItemContent,
  chunkProperties,
  chunkTranscript,
  contentHash,
  estimateTokens,
  type ChunkDraft,
  type PropertyResolutionMaps,
} from "@/features/ai/lib/chunking";
import { isAiModuleEnabled, isFinanceContactsIndexingEnabled } from "@/features/settings/queries";
import type { FieldDefinition } from "@/features/types/schemas";
import { estimateEmbeddingCostUsd } from "@/lib/ai/pricing";
import { getEmbeddingsProvider } from "@/lib/embeddings";
import type { Json } from "@/lib/supabase/database.types";
import type { Segment } from "@/lib/transcription/types";
import type { JobContext, JobHandler } from "../types";

const payloadSchema = z.object({ itemId: z.string().uuid() });

type Client = JobContext["supabase"];

interface IndexRow {
  source: "content" | "attachment" | "transcript" | "properties";
  sourceId: string | null;
  chunkIndex: number;
  content: string;
  tokenEstimate: number;
  metadata: Record<string, unknown>;
  contentHash: string;
}

function toIndexRows(source: IndexRow["source"], sourceId: string | null, drafts: ChunkDraft[]): IndexRow[] {
  return drafts.map((draft, index) => ({
    source,
    sourceId,
    chunkIndex: index,
    content: draft.text,
    tokenEstimate: estimateTokens(draft.text),
    metadata: draft.metadata,
    contentHash: contentHash(draft.text),
  }));
}

/** Apaga os trechos de um item — reaproveitado tanto pra "pular" (IA desligada/item excluído) quanto pra antes de regravar. */
async function deleteItemChunks(supabase: Client, itemId: string): Promise<void> {
  await supabase.from("item_chunks").delete().eq("item_id", itemId);
}

async function resolvePropertyMaps(supabase: Client, ownerId: string, fields: FieldDefinition[], properties: Record<string, unknown>): Promise<PropertyResolutionMaps> {
  const contactIds = new Set<string>();
  const itemIds = new Set<string>();

  for (const field of fields) {
    const raw = properties[field.key];
    if (raw == null) continue;
    const ids = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    if (field.type === "contact") ids.forEach((id) => contactIds.add(id));
    if (field.type === "relation") ids.forEach((id) => itemIds.add(id));
  }

  const [contacts, items] = await Promise.all([
    contactIds.size > 0 ? supabase.from("contacts").select("id, name").eq("owner_id", ownerId).in("id", [...contactIds]) : Promise.resolve({ data: [] }),
    itemIds.size > 0 ? supabase.from("items").select("id, title").eq("owner_id", ownerId).in("id", [...itemIds]) : Promise.resolve({ data: [] }),
  ]);

  return {
    contactNames: new Map((contacts.data ?? []).map((c) => [c.id, c.name] as const)),
    itemTitles: new Map((items.data ?? []).map((i) => [i.id, i.title] as const)),
  };
}

/**
 * Job `index_item` (6.5): recalcula os trechos indexáveis de um item e seus
 * embeddings, pra busca semântica (6.6). Sempre relê o item do zero — o
 * payload só carrega `itemId`, nunca um snapshot de conteúdo (`enqueue-index.ts`).
 *
 * 1. Pula (e apaga trechos existentes) se o item foi excluído, a IA está
 *    desligada globalmente ou desligada no espaço do item.
 * 2. Hash geral (`title` + `content_text` + `extra_text` + `properties`) —
 *    se igual a `items.indexed_hash`, não tem nada novo pra indexar.
 * 3. Gera os trechos de conteúdo/anexos/transcrições/propriedades, reaproveita
 *    o embedding de qualquer trecho já indexado antes com o mesmo `content_hash`
 *    (mesmo texto, palavra por palavra) e manda só os trechos novos em lote
 *    pro provedor.
 * 4. Substitui os trechos do item (apaga tudo, grava de novo — não é uma
 *    transação Postgres de verdade, ver `docs/decisoes.md`), atualiza
 *    `indexed_hash`/`indexed_at` e registra `usage_events` (só se algum
 *    trecho novo foi embedado — reaproveitamento total não gera custo).
 */
export const indexItem: JobHandler = async (job, { supabase }) => {
  const parsed = payloadSchema.safeParse(job.payload);
  if (!parsed.success) return { status: "failed", error: "Payload inválido para index_item." };

  const { itemId } = parsed.data;
  const ownerId = job.owner_id;

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, title, content, content_text, extra_text, properties, space_id, deleted_at, indexed_hash, object_types(fields)")
    .eq("id", itemId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (itemError) return { status: "retry", error: itemError.message };

  if (!item || item.deleted_at) {
    await deleteItemChunks(supabase, itemId);
    return { status: "done", result: { skipped: "deleted" } };
  }

  const aiEnabled = await isAiModuleEnabled(supabase, ownerId);
  if (!aiEnabled) {
    await deleteItemChunks(supabase, itemId);
    return { status: "done", result: { skipped: "ai_disabled" } };
  }

  if (item.space_id) {
    const { data: space } = await supabase.from("spaces").select("ai_enabled").eq("id", item.space_id).maybeSingle();
    if (space && !space.ai_enabled) {
      await deleteItemChunks(supabase, itemId);
      return { status: "done", result: { skipped: "space_ai_disabled" } };
    }
  }

  const provider = getEmbeddingsProvider();
  if (!provider) return { status: "done", result: { skipped: "no_provider" } };

  const properties = (item.properties as Record<string, unknown> | null) ?? {};
  const overallHash = contentHash(
    JSON.stringify({ title: item.title, contentText: item.content_text, extraText: item.extra_text, properties }),
  );
  if (item.indexed_hash === overallHash) {
    return { status: "done", result: { skipped: "unchanged" } };
  }

  const fields = (item.object_types?.fields as unknown as FieldDefinition[] | null) ?? [];

  const [{ data: attachments }, { data: transcripts }, includeFinanceContacts] = await Promise.all([
    supabase.from("attachments").select("id, extracted_text, page_count").eq("item_id", itemId).eq("extraction_status", "done"),
    supabase.from("transcripts").select("id, segments, speaker_names").eq("item_id", itemId).eq("status", "completed"),
    isFinanceContactsIndexingEnabled(supabase, ownerId),
  ]);

  const propertyMaps = await resolvePropertyMaps(supabase, ownerId, fields, properties);

  const rows: IndexRow[] = [...toIndexRows("content", null, chunkItemContent(item.title, item.content as never))];

  for (const attachment of attachments ?? []) {
    if (!attachment.extracted_text) continue;
    rows.push(...toIndexRows("attachment", attachment.id, chunkAttachmentText(attachment.extracted_text, attachment.page_count)));
  }

  for (const transcript of transcripts ?? []) {
    const segments = (transcript.segments as unknown as Segment[] | null) ?? [];
    const speakerNames = (transcript.speaker_names as Record<string, string> | null) ?? {};
    rows.push(...toIndexRows("transcript", transcript.id, chunkTranscript(segments, speakerNames)));
  }

  const propertiesChunk = chunkProperties(fields, properties, propertyMaps, { includeFinanceContacts });
  if (propertiesChunk) rows.push(...toIndexRows("properties", null, [propertiesChunk]));

  const { data: existingChunks } = await supabase.from("item_chunks").select("content_hash, embedding, embedding_model").eq("item_id", itemId);
  const reusable = new Map((existingChunks ?? []).map((row) => [row.content_hash, { embedding: row.embedding, model: row.embedding_model }]));

  const toEmbed = rows.filter((row) => !reusable.has(row.contentHash));
  const embeddings = toEmbed.length > 0 ? await provider.embedDocuments(toEmbed.map((row) => row.content)) : [];
  const freshByHash = new Map(toEmbed.map((row, index) => [row.contentHash, embeddings[index]]));

  const finalRows = rows.map((row) => ({
    owner_id: ownerId,
    item_id: itemId,
    source: row.source,
    source_id: row.sourceId,
    chunk_index: row.chunkIndex,
    content: row.content,
    token_estimate: row.tokenEstimate,
    metadata: row.metadata as unknown as Json,
    content_hash: row.contentHash,
    embedding: (reusable.get(row.contentHash)?.embedding ?? freshByHash.get(row.contentHash) ?? null) as unknown as Json,
    embedding_model: reusable.get(row.contentHash)?.model ?? (freshByHash.has(row.contentHash) ? provider.model : null),
  }));

  await deleteItemChunks(supabase, itemId);
  if (finalRows.length > 0) {
    const { error: insertError } = await supabase.from("item_chunks").insert(finalRows);
    if (insertError) return { status: "retry", error: insertError.message };
  }

  await supabase.from("items").update({ indexed_hash: overallHash, indexed_at: new Date().toISOString() }).eq("id", itemId);

  if (toEmbed.length > 0) {
    const totalTokens = toEmbed.reduce((sum, row) => sum + row.tokenEstimate, 0);
    await supabase.from("usage_events").insert({
      owner_id: ownerId,
      provider: "embeddings",
      feature: "index_item",
      model: provider.model,
      units: { total_tokens: totalTokens } as unknown as Json,
      cost_usd: estimateEmbeddingCostUsd(provider.model, totalTokens),
      item_id: itemId,
    });
  }

  return { status: "done", result: { chunks: finalRows.length, embedded: toEmbed.length, reused: finalRows.length - toEmbed.length } };
};
