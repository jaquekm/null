import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueIndexItem } from "@/features/ai/lib/enqueue-index";
import { enqueueJob } from "@/lib/jobs/enqueue";
import type { Database, Json } from "@/lib/supabase/database.types";
import { estimateTranscriptionCostUsd } from "@/lib/transcription/pricing";
import type { TranscriptionResult } from "@/lib/transcription/types";

type Client = SupabaseClient<Database>;

export interface TranscriptForResult {
  id: string;
  ownerId: string;
  itemId: string;
  provider: string;
  summarize: boolean;
}

/**
 * Aplica um resultado do provedor de transcrição — a mesma lógica usada pela
 * rota de webhook e pelo job `poll_transcription` (2.6, o enunciado descreve
 * um único fluxo pros dois). Idempotente: o `update` só afeta a linha se ela
 * ainda estiver `processing` (aproveita o lock de linha do Postgres — duas
 * chamadas concorrentes pro mesmo transcript nunca duplicam os efeitos
 * colaterais abaixo, só uma delas "ganha" a corrida do UPDATE).
 */
export async function applyTranscriptionResult(
  supabase: Client,
  transcript: TranscriptForResult,
  result: TranscriptionResult,
): Promise<"completed" | "failed" | "processing"> {
  if (result.status === "processing") return "processing";

  if (result.status === "failed") {
    await supabase
      .from("transcripts")
      .update({ status: "failed", error: result.error })
      .eq("id", transcript.id)
      .eq("status", "processing");
    return "failed";
  }

  const { data: updated, error: updateError } = await supabase
    .from("transcripts")
    .update({
      status: "completed",
      text: result.text,
      segments: result.segments as unknown as Json,
      duration_seconds: result.durationSeconds,
    })
    .eq("id", transcript.id)
    .eq("status", "processing")
    .select("id");
  if (updateError) throw updateError;
  if (!updated || updated.length === 0) return "completed"; // outra chamada já resolveu (webhook + poll em corrida)

  const { error: rpcError } = await supabase.rpc("refresh_item_extra_text", { p_item_id: transcript.itemId });
  if (rpcError) throw rpcError;

  await enqueueIndexItem(transcript.ownerId, transcript.itemId);

  await supabase.from("usage_events").insert({
    owner_id: transcript.ownerId,
    provider: "transcription",
    feature: "transcription",
    model: transcript.provider,
    units: { seconds: result.durationSeconds } as unknown as Json,
    cost_usd: estimateTranscriptionCostUsd(transcript.provider, result.durationSeconds),
    item_id: transcript.itemId,
  });

  const { data: item } = await supabase
    .from("items")
    .select("object_types(slug)")
    .eq("id", transcript.itemId)
    .maybeSingle();
  const isMeeting = item?.object_types?.slug === "reuniao";

  if (isMeeting || transcript.summarize) {
    await enqueueJob({
      ownerId: transcript.ownerId,
      kind: "summarize_transcript",
      payload: { transcriptId: transcript.id },
      dedupeKey: `summarize:${transcript.id}`,
    });
  }

  return "completed";
}
