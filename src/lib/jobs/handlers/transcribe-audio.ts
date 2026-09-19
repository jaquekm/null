import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { getTranscriptionProvider } from "@/lib/transcription";
import { enqueueJob } from "../enqueue";
import type { JobHandler } from "../types";

const payloadSchema = z.object({ transcriptId: z.string().uuid() });

/** URL assinada do Storage, válida pelo tempo do enunciado (2.6). */
const SIGNED_URL_EXPIRES_IN_SECONDS = 24 * 60 * 60;
/** Primeiro `poll_transcription` só depois de meia hora — o webhook costuma chegar bem antes disso. */
const FIRST_POLL_DELAY_SECONDS = 30 * 60;
/**
 * Folga sobre as ~12 tentativas de 30 min que caberiam no teto de 6h do
 * `poll_transcription` (enunciado) — quem realmente corta em 6h é o próprio
 * handler do poll, comparando tempo decorrido; isto aqui só evita que a fila
 * pare de tentar por ter esgotado `attempts` antes da hora.
 */
const POLL_MAX_ATTEMPTS = 15;

/**
 * Job `transcribe_audio` (2.6): pega o anexo do transcript, gera uma URL
 * assinada e manda pro provedor de transcrição (2.4) com o webhook desta
 * app como destino. Enfileira `poll_transcription` como garantia caso o
 * webhook não chegue.
 */
export const transcribeAudio: JobHandler = async (job, { supabase }) => {
  const parsed = payloadSchema.safeParse(job.payload);
  if (!parsed.success) return { status: "failed", error: "Payload inválido — falta transcriptId." };
  const { transcriptId } = parsed.data;

  const { data: transcript, error: transcriptError } = await supabase
    .from("transcripts")
    .select("id, owner_id, attachment_id, language, status")
    .eq("id", transcriptId)
    .maybeSingle();
  if (transcriptError) return { status: "retry", error: transcriptError.message };
  if (!transcript) return { status: "failed", error: "Transcrição não encontrada." };
  // já processado (job duplicado/reprocessado) — nada a fazer, idempotente.
  if (transcript.status !== "queued") return { status: "done" };

  const { data: attachment, error: attachmentError } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", transcript.attachment_id)
    .maybeSingle();
  if (attachmentError || !attachment) return { status: "failed", error: "Anexo do áudio não encontrado." };

  const provider = getTranscriptionProvider();
  if (!provider) return { status: "failed", error: "Provedor de transcrição não configurado." };

  const { data: signed, error: signError } = await supabase.storage
    .from("attachments")
    .createSignedUrl(attachment.storage_path, SIGNED_URL_EXPIRES_IN_SECONDS);
  if (signError || !signed) return { status: "retry", error: "Não foi possível gerar a URL assinada do áudio." };

  let externalId: string;
  try {
    const submitted = await provider.submit({
      audioUrl: signed.signedUrl,
      language: transcript.language ?? "pt",
      diarization: true,
      webhookUrl: `${serverEnv.APP_URL}/api/webhooks/transcription`,
    });
    externalId = submitted.externalId;
  } catch (err) {
    return { status: "retry", error: err instanceof Error ? err.message : "Falha ao enviar o áudio pra transcrição." };
  }

  const { error: updateError } = await supabase
    .from("transcripts")
    .update({ external_id: externalId, status: "processing" })
    .eq("id", transcriptId);
  if (updateError) return { status: "retry", error: updateError.message };

  await enqueueJob({
    ownerId: transcript.owner_id,
    kind: "poll_transcription",
    payload: { transcriptId },
    runAfter: new Date(Date.now() + FIRST_POLL_DELAY_SECONDS * 1000),
    dedupeKey: `poll:${transcriptId}`,
    maxAttempts: POLL_MAX_ATTEMPTS,
  });

  return { status: "done" };
};
