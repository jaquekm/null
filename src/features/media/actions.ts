"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCaptureItem } from "@/features/capture/lib/create-capture-item";
import { getObjectTypeBySlug } from "@/features/types/queries";
import { requireOwner } from "@/lib/auth";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { fail, ok, type Result } from "@/lib/result";
import { getTranscriptionProvider } from "@/lib/transcription";

const createRecordingItemSchema = z.object({
  typeSlug: z.enum(["nota", "reuniao"]),
  title: z.string().trim().min(1).max(200),
});

/**
 * Cria o item que vai receber a gravação (2.5, pontos de entrada 1 e 2b: o
 * botão "Gravar"/"Gravar reunião" da captura rápida ainda não tem um item
 * pra anexar). Reaproveita `createCaptureItem` (1.10) com `source: 'voice'`.
 */
export async function createRecordingItem(typeSlug: "nota" | "reuniao", title: string): Promise<Result<{ id: string }>> {
  const parsed = createRecordingItemSchema.safeParse({ typeSlug, title });
  if (!parsed.success) return fail("Dados inválidos.");

  const { supabase, user } = await requireOwner();

  const type = await getObjectTypeBySlug(supabase, parsed.data.typeSlug);
  if (!type) return fail(`Tipo "${parsed.data.typeSlug}" não encontrado.`);

  const result = await createCaptureItem(supabase, {
    ownerId: user.id,
    title: parsed.data.title,
    body: "",
    spaceId: null,
    typeId: type.id,
    source: "voice",
  });
  if (!result) return fail("Não foi possível criar o item.");

  revalidatePath("/inbox");
  return ok(result);
}

const requestTranscriptionSchema = z.object({
  itemId: z.string().uuid(),
  attachmentId: z.string().uuid(),
  durationSeconds: z.number().positive().optional(),
  summarize: z.boolean().optional(),
});

/**
 * Depois do upload de um áudio/vídeo — gravado (2.5, pontos 1/2) ou enviado
 * (2.5, ponto 3: "pergunta 'Transcrever?'") — registra `transcripts` e
 * enfileira `transcribe_audio` (`dedupeKey = 'transcribe:' + attachmentId`,
 * como o enunciado pede). O handler do job é só da 2.6; até lá o job fica
 * na fila sem rodar de verdade.
 *
 * `null` quando não há provedor de transcrição configurado (2.4) — o anexo
 * continua salvo normalmente, só não tem como transcrever ainda; quem
 * chama decide se avisa o usuário disso.
 *
 * `summarize`: opt-in explícito pra gerar resumo (2.6/2.7) em item que não é
 * do tipo Reunião — um item Reunião sempre resume, com ou sem essa flag
 * (`applyTranscriptionResult`, `features/transcripts/lib/`).
 */
export async function requestTranscription(
  itemId: string,
  attachmentId: string,
  durationSeconds?: number,
  summarize?: boolean,
): Promise<Result<{ transcriptId: string } | null>> {
  const parsed = requestTranscriptionSchema.safeParse({ itemId, attachmentId, durationSeconds, summarize });
  if (!parsed.success) return fail("Dados inválidos.");

  const provider = getTranscriptionProvider();
  if (!provider) return ok(null);

  const { supabase, user } = await requireOwner();

  // Idempotente: clicar em "Transcrever" mais de uma vez pro mesmo anexo
  // (ex.: duplo clique) reaproveita a transcrição já pedida em vez de criar
  // uma segunda linha — `dedupeKey` no enqueue evita job duplicado, mas não
  // evitaria uma segunda linha em `transcripts`.
  const { data: existing } = await supabase
    .from("transcripts")
    .select("id")
    .eq("attachment_id", parsed.data.attachmentId)
    .maybeSingle();
  if (existing) return ok({ transcriptId: existing.id });

  const { data, error } = await supabase
    .from("transcripts")
    .insert({
      owner_id: user.id,
      item_id: parsed.data.itemId,
      attachment_id: parsed.data.attachmentId,
      provider: provider.name,
      status: "queued",
      duration_seconds: parsed.data.durationSeconds ?? null,
      summarize: parsed.data.summarize ?? false,
    })
    .select("id")
    .single();
  if (error || !data) return fail("Não foi possível registrar a transcrição.");

  await enqueueJob({
    ownerId: user.id,
    kind: "transcribe_audio",
    payload: { transcriptId: data.id },
    dedupeKey: `transcribe:${parsed.data.attachmentId}`,
  });

  revalidatePath(`/itens/${parsed.data.itemId}`);
  return ok({ transcriptId: data.id });
}
