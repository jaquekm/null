import { z } from "zod";
import { applyTranscriptionResult } from "@/features/transcripts/lib/apply-result";
import { getTranscriptionProvider } from "@/lib/transcription";
import type { JobHandler } from "../types";

const payloadSchema = z.object({ transcriptId: z.string().uuid() });

/** Intervalo entre consultas enquanto o provedor ainda está processando. */
const POLL_INTERVAL_SECONDS = 30 * 60;
/** Teto do enunciado (2.6): "se continuar processando, reagendar (máx. 6h)". */
const MAX_POLL_DURATION_MS = 6 * 60 * 60 * 1000;

/**
 * Job `poll_transcription` (2.6): garantia caso o webhook do provedor não
 * chegue. Reaproveita `applyTranscriptionResult` — a mesma lógica de
 * "completed"/"failed" da rota de webhook. O teto de 6h é medido pelo tempo
 * decorrido desde a criação do transcript (aproximação razoável — o `submit`
 * do `transcribe_audio` roda segundos depois disso, não horas), não por
 * `attempts`: `attempts`/`maxAttempts` só existem aqui como garantia extra
 * (ver `transcribe-audio.ts`), quem corta de fato é esta comparação.
 */
export const pollTranscription: JobHandler = async (job, { supabase }) => {
  const parsed = payloadSchema.safeParse(job.payload);
  if (!parsed.success) return { status: "failed", error: "Payload inválido — falta transcriptId." };
  const { transcriptId } = parsed.data;

  const { data: transcript, error } = await supabase
    .from("transcripts")
    .select("id, owner_id, item_id, provider, external_id, status, summarize, created_at")
    .eq("id", transcriptId)
    .maybeSingle();
  if (error) return { status: "retry", error: error.message };
  if (!transcript) return { status: "done" }; // apagado nesse meio tempo
  if (transcript.status !== "processing") return { status: "done" }; // o webhook já resolveu

  if (!transcript.external_id) {
    return { status: "failed", error: "Transcrição 'processing' sem external_id — estado inconsistente." };
  }

  const provider = getTranscriptionProvider();
  if (!provider) return { status: "failed", error: "Provedor de transcrição não configurado." };

  const result = await provider.fetchResult(transcript.external_id);
  const outcome = await applyTranscriptionResult(
    supabase,
    {
      id: transcript.id,
      ownerId: transcript.owner_id,
      itemId: transcript.item_id,
      provider: transcript.provider,
      summarize: transcript.summarize,
    },
    result,
  );

  if (outcome !== "processing") return { status: "done" };

  const elapsedMs = Date.now() - new Date(transcript.created_at).getTime();
  if (elapsedMs >= MAX_POLL_DURATION_MS) {
    await supabase
      .from("transcripts")
      .update({ status: "failed", error: "Tempo limite de transcrição excedido (6h)." })
      .eq("id", transcript.id)
      .eq("status", "processing");
    return { status: "failed", error: "Tempo limite de transcrição excedido (6h)." };
  }

  return { status: "retry", error: "Ainda processando.", delaySeconds: POLL_INTERVAL_SECONDS };
};
