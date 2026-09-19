"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { textToDoc } from "@/features/capture/lib/text-to-doc";
import { extractText } from "@/features/items/lib/extract-text";
import { getObjectTypeBySlug } from "@/features/types/queries";
import { requireOwner } from "@/lib/auth";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import type { Segment } from "@/lib/transcription/types";
import { recomposeText } from "./lib/recompose-text";

/** "Gerar resumo novamente" (2.7): reenfileira `summarize_transcript` com `force: true`, mesmo já tendo um resumo salvo. */
export async function regenerateSummary(transcriptId: string, itemId: string): Promise<Result<null>> {
  const { user } = await requireOwner();

  await enqueueJob({
    ownerId: user.id,
    kind: "summarize_transcript",
    payload: { transcriptId, force: true },
    dedupeKey: `summarize:${transcriptId}`,
  });

  revalidatePath(`/itens/${itemId}`);
  return ok(null);
}

const actionInputSchema = z.object({
  descricao: z.string().trim().min(1).max(300),
  responsavel: z.string().trim().max(200).nullable(),
  prazo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD")
    .nullable(),
  spaceId: z.string().uuid().nullable(),
});

const createTasksSchema = z.object({
  meetingItemId: z.string().uuid(),
  tasks: z.array(actionInputSchema).min(1),
});

export interface TaskFromAction {
  descricao: string;
  responsavel: string | null;
  prazo: string | null;
  spaceId: string | null;
}

/**
 * "Criar tarefas das ações" (2.7): um item do tipo Tarefa por ação revisada
 * (o dono edita descrição/prazo/espaço antes de confirmar — o enunciado não
 * inclui "responsável" entre os campos editáveis, e o tipo Tarefa não tem
 * campo próprio pra isso; guardo como uma linha no conteúdo do item pra não
 * simplesmente descartar o que a IA sugeriu). Liga cada tarefa à reunião via
 * `links` (`kind='relation'`) — não é um campo declarado do tipo, então
 * `field_key` fica nulo.
 */
export async function createTasksFromActions(meetingItemId: string, tasks: TaskFromAction[]): Promise<Result<{ createdCount: number }>> {
  const parsed = createTasksSchema.safeParse({ meetingItemId, tasks });
  if (!parsed.success) return fail("Dados inválidos.");

  const { supabase, user } = await requireOwner();

  const taskType = await getObjectTypeBySlug(supabase, "tarefa");
  if (!taskType) return fail('Tipo "Tarefa" não encontrado.');

  let createdCount = 0;
  for (const task of parsed.data.tasks) {
    const content = task.responsavel ? textToDoc(`Responsável sugerido: ${task.responsavel}`) : null;

    const { data: created, error } = await supabase
      .from("items")
      .insert({
        owner_id: user.id,
        title: task.descricao,
        type_id: taskType.id,
        space_id: task.spaceId,
        status: task.spaceId ? "active" : "inbox",
        properties: { status: "todo", ...(task.prazo ? { prazo: task.prazo } : {}) },
        content: content as unknown as Json,
        content_text: content ? extractText(content) : "",
      })
      .select("id")
      .single();
    if (error || !created) continue; // uma falha isolada não impede criar as outras tarefas da lista

    await supabase.from("links").insert({ owner_id: user.id, source_id: meetingItemId, target_id: created.id, kind: "relation" });
    createdCount++;
  }

  if (createdCount === 0) return fail("Não foi possível criar nenhuma tarefa.");

  revalidatePath(`/itens/${meetingItemId}`);
  return ok({ createdCount });
}

const updateSpeakerNameSchema = z.object({
  transcriptId: z.string().uuid(),
  speakerKey: z.string().min(1).max(50),
  name: z.string().trim().min(1).max(100),
});

/** "Renomear locutores" (2.8): salva em `speaker_names` (ex.: `{"A": "João"}`). */
export async function updateSpeakerName(transcriptId: string, speakerKey: string, name: string): Promise<Result<null>> {
  const parsed = updateSpeakerNameSchema.safeParse({ transcriptId, speakerKey, name });
  if (!parsed.success) return fail("Dados inválidos.");

  const { supabase } = await requireOwner();

  const { data: transcript, error: readError } = await supabase
    .from("transcripts")
    .select("item_id, speaker_names")
    .eq("id", parsed.data.transcriptId)
    .maybeSingle();
  if (readError || !transcript) return fail("Transcrição não encontrada.");

  const speakerNames = {
    ...((transcript.speaker_names as Record<string, string> | null) ?? {}),
    [parsed.data.speakerKey]: parsed.data.name,
  };

  const { error } = await supabase
    .from("transcripts")
    .update({ speaker_names: speakerNames as unknown as Json })
    .eq("id", parsed.data.transcriptId);
  if (error) return fail("Não foi possível renomear o locutor.");

  revalidatePath(`/itens/${transcript.item_id}`);
  return ok(null);
}

const updateSegmentTextSchema = z.object({
  transcriptId: z.string().uuid(),
  segmentIndex: z.number().int().nonnegative(),
  text: z.string().trim().min(1).max(5000),
});

/**
 * "Corrigir texto de um segmento" (2.8): edita `segments[i].text` e
 * recompõe `transcripts.text` (`recomposeText`) — e, como `text` alimenta
 * `items.extra_text` (`refresh_item_extra_text`, 2.1), recalcula ele também
 * pra busca não ficar com o texto antigo.
 */
export async function updateSegmentText(transcriptId: string, segmentIndex: number, text: string): Promise<Result<null>> {
  const parsed = updateSegmentTextSchema.safeParse({ transcriptId, segmentIndex, text });
  if (!parsed.success) return fail("Dados inválidos.");

  const { supabase } = await requireOwner();

  const { data: transcript, error: readError } = await supabase
    .from("transcripts")
    .select("item_id, segments")
    .eq("id", parsed.data.transcriptId)
    .maybeSingle();
  if (readError || !transcript) return fail("Transcrição não encontrada.");

  const segments = (transcript.segments as unknown as Segment[] | null) ?? [];
  if (parsed.data.segmentIndex >= segments.length) return fail("Segmento não encontrado.");

  const updatedSegments = segments.map((segment, index) =>
    index === parsed.data.segmentIndex ? { ...segment, text: parsed.data.text } : segment,
  );
  const newText = recomposeText(updatedSegments);

  const { error } = await supabase
    .from("transcripts")
    .update({ segments: updatedSegments as unknown as Json, text: newText })
    .eq("id", parsed.data.transcriptId);
  if (error) return fail("Não foi possível salvar a correção.");

  await supabase.rpc("refresh_item_extra_text", { p_item_id: transcript.item_id });

  revalidatePath(`/itens/${transcript.item_id}`);
  return ok(null);
}
