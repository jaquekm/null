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
