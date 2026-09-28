import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOwnerNotificationPreferences } from "@/features/settings/queries";
import { notifyOwner } from "@/lib/messaging/notify-owner";
import type { Database, Json } from "@/lib/supabase/database.types";
import { handlers as defaultHandlers } from "./registry";
import { resolveJobTransition } from "./resolve-transition";
import type { Job, JobHandler, JobOutcome } from "./types";

/**
 * Roda um job já reservado (`claim_jobs`) até o fim: despacha pro handler
 * do `kind`, normaliza uma exceção não tratada como `retry` (mesma regra do
 * enunciado da 2.2), calcula a transição (`resolveJobTransition`) e
 * persiste. `handlers` é injetável só pra teste — em produção usa sempre o
 * registro de verdade.
 */
export async function runJob(
  supabase: SupabaseClient<Database>,
  job: Job,
  handlers: Record<string, JobHandler> = defaultHandlers,
): Promise<void> {
  const handler = handlers[job.kind];

  let outcome: JobOutcome;
  if (!handler) {
    outcome = { status: "failed", error: `Handler desconhecido para o tipo de job "${job.kind}".` };
  } else {
    try {
      outcome = await handler(job, { supabase });
    } catch (err) {
      outcome = { status: "retry", error: err instanceof Error ? err.message : "Erro desconhecido." };
    }
  }

  const transition = resolveJobTransition({ attempts: job.attempts, maxAttempts: job.max_attempts }, outcome);

  await supabase
    .from("jobs")
    .update({
      status: transition.status,
      finished_at: transition.finishedAt ?? null,
      run_after: transition.runAfter ?? job.run_after,
      last_error: transition.lastError ?? null,
      result: (transition.result as Json | undefined) ?? null,
      locked_at: null,
    })
    .eq("id", job.id);

  if (transition.status === "failed") {
    await releaseLinkedRecord(supabase, job, transition.lastError ?? "Falhou.");
    const preferences = await getOwnerNotificationPreferences(supabase, job.owner_id);
    if (preferences.jobFailures) {
      await notifyOwner(job.owner_id, {
        title: "Job com falha",
        text: `"${job.kind}" esgotou as tentativas: ${transition.lastError ?? "erro desconhecido"}.`,
      });
    }
  }
}

/**
 * Job que desistiu de vez não pode deixar o registro que ele ia resolver
 * preso em "processando" na tela (transcrição, extração de texto) — o
 * handler só marca isso nos caminhos que ele próprio prevê; exceção,
 * tempo esgotado e tentativas esgotadas caem aqui.
 */
async function releaseLinkedRecord(supabase: SupabaseClient<Database>, job: Job, error: string): Promise<void> {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  if ((job.kind === "transcribe_audio" || job.kind === "poll_transcription") && typeof payload.transcriptId === "string") {
    await supabase
      .from("transcripts")
      .update({ status: "failed", error })
      .eq("id", payload.transcriptId)
      .in("status", ["queued", "processing"]);
  }
  if (job.kind === "extract_attachment" && typeof payload.attachmentId === "string") {
    await supabase
      .from("attachments")
      .update({ extraction_status: "failed" })
      .eq("id", payload.attachmentId)
      .in("extraction_status", ["queued", "processing"]);
  }
}
