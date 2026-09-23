"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCaptureItem } from "@/features/capture/lib/create-capture-item";
import { requireOwner } from "@/lib/auth";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { fail, ok, type Result } from "@/lib/result";
import {
  createRelatedLink,
  deleteConversation,
  getConversationMessages,
  listActiveItemIds,
  renameConversation,
  type AiMessageRow,
} from "./queries";

/**
 * "Reindexar tudo" (6.5, `/configuracoes/ia`) — enfileira `index_item` pra
 * todo item ativo do dono, sem o debounce de 2 min (`enqueueIndexItem`,
 * pensado pra digitação) — é um pedido explícito e único, não faz sentido
 * atrasar. `dedupeKey` continua evitando duplicar se algum item já tiver um
 * `index_item` pendente (ex.: uma edição recente). Progresso: acompanhar em
 * Configurações → Jobs (fila já mostra status/contagem por `kind`).
 */
export async function reindexAllItems(): Promise<Result<{ count: number }>> {
  const { supabase, user } = await requireOwner();

  const itemIds = await listActiveItemIds(supabase, user.id);
  for (const itemId of itemIds) {
    await enqueueJob({ ownerId: user.id, kind: "index_item", payload: { itemId }, dedupeKey: `index:${itemId}` });
  }

  if (itemIds.length === 0) return fail("Nenhum item pra reindexar.");
  return ok({ count: itemIds.length });
}

/** "Criar link" no painel "Talvez relacionado" (6.6). */
export async function createRelatedLinkAction(itemId: string, relatedItemId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  try {
    await createRelatedLink(supabase, user.id, itemId, relatedItemId);
  } catch {
    return fail("Não foi possível criar o link.");
  }

  revalidatePath(`/itens/${itemId}`);
  return ok(null);
}

/** Histórico completo de uma conversa salva, ao clicar nela na lateral (6.7). */
export async function loadConversationMessages(conversationId: string): Promise<Result<AiMessageRow[]>> {
  const { supabase } = await requireOwner();
  try {
    return ok(await getConversationMessages(supabase, conversationId));
  } catch {
    return fail("Não foi possível carregar a conversa.");
  }
}

const renameSchema = z.object({ title: z.string().trim().min(1, "Digite um título.").max(200) });

/** "Renomear" (6.7, lateral de conversas salvas). */
export async function renameConversationAction(conversationId: string, input: unknown): Promise<Result<null>> {
  const { supabase } = await requireOwner();
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Título inválido.");

  try {
    await renameConversation(supabase, conversationId, parsed.data.title);
    revalidatePath("/perguntar");
    return ok(null);
  } catch {
    return fail("Não foi possível renomear a conversa.");
  }
}

/** "Excluir" (6.7, lateral de conversas salvas). */
export async function deleteConversationAction(conversationId: string): Promise<Result<null>> {
  const { supabase } = await requireOwner();
  try {
    await deleteConversation(supabase, conversationId);
    revalidatePath("/perguntar");
    return ok(null);
  } catch {
    return fail("Não foi possível excluir a conversa.");
  }
}

const saveAsNoteSchema = z.object({
  question: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  sources: z.array(z.object({ itemId: z.string().uuid(), title: z.string() })),
});

function buildNoteBody(answer: string, sources: { title: string }[]): string {
  if (sources.length === 0) return answer;
  const uniqueTitles = [...new Set(sources.map((source) => source.title))];
  return `${answer}\n\nFontes:\n${uniqueTitles.map((title) => `- ${title}`).join("\n")}`;
}

/**
 * "Salvar como nota" (6.7, ações sobre a resposta) — cria um item com a
 * resposta e liga (`kind: "related"`, mesmo tipo de link de "Talvez
 * relacionado", 6.6) a cada item citado, sem duplicar por fonte repetida.
 */
export async function saveAnswerAsNoteAction(input: unknown): Promise<Result<{ itemId: string }>> {
  const { supabase, user } = await requireOwner();
  const parsed = saveAsNoteSchema.safeParse(input);
  if (!parsed.success) return fail("Não foi possível salvar a nota.");

  const { question, answer, sources } = parsed.data;
  const result = await createCaptureItem(supabase, {
    ownerId: user.id,
    title: question.length > 200 ? `${question.slice(0, 200)}…` : question,
    body: buildNoteBody(answer, sources),
    spaceId: null,
    typeId: null,
    source: "ask",
  });
  if (!result) return fail("Não foi possível salvar a nota.");

  const uniqueItemIds = [...new Set(sources.map((source) => source.itemId))];
  for (const itemId of uniqueItemIds) {
    await createRelatedLink(supabase, user.id, result.id, itemId);
  }

  revalidatePath("/inbox");
  return ok({ itemId: result.id });
}

const createTaskSchema = z.object({ title: z.string().trim().min(1, "Digite um título.").max(300), answer: z.string().trim().min(1) });

/** "Criar tarefa" (6.7, ações sobre a resposta) — tipo "Tarefa" do sistema (`onboarding/lib/system-types.ts`, slug fixo `tarefa`, sem espaço). */
export async function createTaskFromAnswerAction(input: unknown): Promise<Result<{ itemId: string }>> {
  const { supabase, user } = await requireOwner();
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Não foi possível criar a tarefa.");

  const { data: taskType } = await supabase.from("object_types").select("id").eq("slug", "tarefa").is("space_id", null).maybeSingle();
  if (!taskType) return fail('Tipo "Tarefa" não encontrado.');

  const result = await createCaptureItem(supabase, {
    ownerId: user.id,
    title: parsed.data.title,
    body: parsed.data.answer,
    spaceId: null,
    typeId: taskType.id,
    source: "ask",
  });
  if (!result) return fail("Não foi possível criar a tarefa.");

  revalidatePath("/inbox");
  return ok({ itemId: result.id });
}
