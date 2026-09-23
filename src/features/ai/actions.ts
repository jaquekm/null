"use server";

import type { JSONContent } from "@tiptap/core";
import { formatInTimeZone } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCaptureItem } from "@/features/capture/lib/create-capture-item";
import { buildItemSummaryBlock } from "@/features/ai/lib/build-collapsible-block";
import { buildFillPropertiesPrompt, buildFillPropertiesSuggestions, type FillPropertiesSuggestion } from "@/features/ai/lib/fill-properties";
import { buildOrganizeInboxUserMessage, coerceInboxSuggestion } from "@/features/ai/lib/organize-inbox";
import { extractedTaskSchema, extractTasksSchema, EXTRACT_TASKS_SYSTEM, type ExtractedTask } from "@/features/ai/prompts/extract-tasks";
import { fillPropertiesResultSchema, FILL_PROPERTIES_SYSTEM } from "@/features/ai/prompts/fill-properties";
import { inboxSuggestionSchema, ORGANIZE_INBOX_SYSTEM, type InboxSuggestion } from "@/features/ai/prompts/organize-inbox";
import { buildSuggestConnectionMessage, SUGGEST_CONNECTION_SYSTEM } from "@/features/ai/prompts/suggest-connection";
import { itemSummarySchema, SUMMARIZE_ITEM_SYSTEM, type ItemSummary } from "@/features/ai/prompts/summarize-item";
import { buildImproveTextSystem, IMPROVE_TEXT_ACTIONS, TRANSLATE_LANGUAGES } from "@/features/ai/prompts/improve-text";
import { buildWeeklySummaryMessage, WEEKLY_SUMMARY_SYSTEM } from "@/features/ai/prompts/weekly-summary";
import { chunkText } from "@/features/transcripts/lib/chunk-text";
import { changeItemType, moveItems } from "@/features/items/actions";
import { extractText } from "@/features/items/lib/extract-text";
import { listObjectTypesForPicker } from "@/features/items/queries";
import { weeklyReviewReport } from "@/features/reports/generators/weekly-review-report";
import { runReport } from "@/features/reports/lib/run-report";
import { listActiveSpaces } from "@/features/spaces/queries";
import { addTagToItems } from "@/features/tags/actions";
import type { FieldDefinition } from "@/features/types/schemas";
import { requireOwner } from "@/lib/auth";
import { AiBudgetExceededError, AiDisabledError, callClaude, callClaudeJson } from "@/lib/ai/claude";
import { enqueueJob } from "@/lib/jobs/enqueue";
import type { Json } from "@/lib/supabase/database.types";
import { fail, ok, type Result } from "@/lib/result";
import {
  createRelatedLink,
  deleteConversation,
  getConversationMessages,
  getUserTimezone,
  listActiveItemIds,
  renameConversation,
  type AiMessageRow,
} from "./queries";

/** Acima disso, só a primeira parte do texto entra na chamada — proteção simples, não um pipeline de condensação em blocos como `summarize_transcript` (2.7): uma nota de uso pessoal raramente chega perto disso. */
const SUMMARIZE_MAX_CHARS = 60_000;

/**
 * "Resumir" (6.8) — passo 1, sem gravar nada: gera os bullets pra revisão
 * (`AiAssistantPreview`-like, no cliente) antes de `applyItemSummary` de
 * verdade inserir o bloco. Junta `content_text` + `extra_text` (mesma
 * composição de `estimateReindexCost`, 6.5) pra cobrir "item e anexos" — a
 * extração de anexo/transcrição já cai em `extra_text` bem antes desta tarefa.
 */
export async function previewItemSummary(itemId: string): Promise<Result<ItemSummary>> {
  const { supabase, user } = await requireOwner();
  const { data: item } = await supabase.from("items").select("content_text, extra_text").eq("id", itemId).eq("owner_id", user.id).maybeSingle();
  if (!item) return fail("Item não encontrado.");

  const fullText = [item.content_text, item.extra_text].filter(Boolean).join("\n\n").trim();
  if (!fullText) return fail("Este item ainda não tem conteúdo pra resumir.");

  try {
    const [text] = chunkText(fullText, SUMMARIZE_MAX_CHARS, 0);
    const summary = await callClaudeJson({
      ownerId: user.id,
      itemId,
      feature: "summarize_item",
      system: SUMMARIZE_ITEM_SYSTEM,
      schema: itemSummarySchema,
      messages: [{ role: "user", content: text! }],
    });
    return ok(summary);
  } catch (err) {
    if (err instanceof AiDisabledError || err instanceof AiBudgetExceededError) return fail(err.message);
    return fail("Não foi possível gerar o resumo.");
  }
}

const applySummarySchema = z.object({ bullets: z.array(z.string().trim().min(1)).min(1).max(8) });

/**
 * "Resumir" (6.8) — passo 2: recebe os bullets já revisados (não chama o
 * Claude de novo — evita gastar orçamento duas vezes pela mesma pergunta),
 * salva uma versão `reason: 'ai'` do estado atual e insere o bloco recolhível
 * (`buildItemSummaryBlock`) no topo do conteúdo.
 */
export async function applyItemSummary(itemId: string, input: unknown): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const parsed = applySummarySchema.safeParse(input);
  if (!parsed.success) return fail("Resumo inválido.");

  const { data: item } = await supabase.from("items").select("title, content, properties").eq("id", itemId).eq("owner_id", user.id).maybeSingle();
  if (!item) return fail("Item não encontrado.");

  const { error: versionError } = await supabase.from("item_versions").insert({
    owner_id: user.id,
    item_id: itemId,
    title: item.title,
    content: item.content,
    properties: item.properties,
    reason: "ai",
  });
  if (versionError) return fail("Não foi possível salvar a versão anterior.");

  const existingContent = (item.content as unknown as JSONContent | null) ?? null;
  const newContent: JSONContent = { type: "doc", content: [buildItemSummaryBlock(parsed.data.bullets), ...(existingContent?.content ?? [])] };

  const { error: updateError } = await supabase
    .from("items")
    .update({ content: newContent as unknown as Json, content_text: extractText(newContent) })
    .eq("id", itemId);
  if (updateError) return fail("Não foi possível aplicar o resumo.");

  revalidatePath(`/itens/${itemId}`);
  return ok(null);
}

/**
 * "Extrair tarefas" (6.8) — passo 1: pede as tarefas com prazo detectado,
 * sem criar nada ainda. A data de hoje (fuso do dono) vai no contexto pra
 * datas relativas ("até sexta") virarem `AAAA-MM-DD` de verdade.
 */
export async function previewExtractedTasks(itemId: string): Promise<Result<ExtractedTask[]>> {
  const { supabase, user } = await requireOwner();
  const { data: item } = await supabase.from("items").select("content_text, extra_text").eq("id", itemId).eq("owner_id", user.id).maybeSingle();
  if (!item) return fail("Item não encontrado.");

  const fullText = [item.content_text, item.extra_text].filter(Boolean).join("\n\n").trim();
  if (!fullText) return fail("Este item ainda não tem conteúdo pra extrair tarefas.");

  try {
    const timezone = await getUserTimezone(supabase, user.id);
    const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
    const [text] = chunkText(fullText, SUMMARIZE_MAX_CHARS, 0);

    const result = await callClaudeJson({
      ownerId: user.id,
      itemId,
      feature: "extract_tasks",
      system: EXTRACT_TASKS_SYSTEM,
      schema: extractTasksSchema,
      messages: [{ role: "user", content: `Data de hoje: ${today}\n\n${text}` }],
    });
    return ok(result.tarefas);
  } catch (err) {
    if (err instanceof AiDisabledError || err instanceof AiBudgetExceededError) return fail(err.message);
    return fail("Não foi possível extrair tarefas.");
  }
}

const applyTasksSchema = z.object({ tasks: z.array(extractedTaskSchema).min(1).max(20) });

/**
 * "Extrair tarefas" (6.8) — passo 2: cria um item Tarefa por tarefa mantida
 * na revisão (sem chamar o Claude de novo), com `prazo` preenchido quando
 * detectado, e liga cada tarefa nova ao item de origem (`kind: "related"`,
 * mesmo padrão de "Salvar como nota", 6.7).
 */
export async function applyExtractedTasks(itemId: string, input: unknown): Promise<Result<{ count: number }>> {
  const { supabase, user } = await requireOwner();
  const parsed = applyTasksSchema.safeParse(input);
  if (!parsed.success) return fail("Tarefas inválidas.");

  const { data: taskType } = await supabase.from("object_types").select("id").eq("slug", "tarefa").is("space_id", null).maybeSingle();
  if (!taskType) return fail('Tipo "Tarefa" não encontrado.');

  let count = 0;
  for (const task of parsed.data.tasks) {
    const result = await createCaptureItem(supabase, {
      ownerId: user.id,
      title: task.descricao,
      body: "",
      spaceId: null,
      typeId: taskType.id,
      source: "ai_extract_tasks",
    });
    if (!result) continue;

    if (task.prazo) {
      await supabase.from("items").update({ properties: { prazo: task.prazo } }).eq("id", result.id);
    }
    await createRelatedLink(supabase, user.id, result.id, itemId);
    count++;
  }

  if (count === 0) return fail("Não foi possível criar as tarefas.");

  revalidatePath("/inbox");
  revalidatePath(`/itens/${itemId}`);
  return ok({ count });
}

/**
 * "Preencher propriedades" (6.8) — passo 1: descreve os campos preenchíveis
 * do tipo do item (`buildFillPropertiesPrompt` — só tipos simples, ver
 * `fillableFields`) e pede os valores encontrados no conteúdo.
 */
export async function previewFilledProperties(itemId: string): Promise<Result<FillPropertiesSuggestion[]>> {
  const { supabase, user } = await requireOwner();
  const { data: item } = await supabase.from("items").select("content_text, extra_text, type_id").eq("id", itemId).eq("owner_id", user.id).maybeSingle();
  if (!item) return fail("Item não encontrado.");
  if (!item.type_id) return fail("Este item não tem um tipo definido.");

  const { data: type } = await supabase.from("object_types").select("fields").eq("id", item.type_id).maybeSingle();
  const fields = (type?.fields as unknown as FieldDefinition[] | null) ?? [];
  if (fields.length === 0) return fail("O tipo deste item não tem campos.");

  const fullText = [item.content_text, item.extra_text].filter(Boolean).join("\n\n").trim();
  if (!fullText) return fail("Este item ainda não tem conteúdo pra extrair propriedades.");

  try {
    const [text] = chunkText(fullText, SUMMARIZE_MAX_CHARS, 0);
    const raw = await callClaudeJson({
      ownerId: user.id,
      itemId,
      feature: "fill_properties",
      system: FILL_PROPERTIES_SYSTEM,
      schema: fillPropertiesResultSchema,
      messages: [{ role: "user", content: `Campos:\n${buildFillPropertiesPrompt(fields)}\n\nConteúdo:\n${text}` }],
    });

    const suggestions = buildFillPropertiesSuggestions(fields, raw);
    if (suggestions.length === 0) return fail("Não foi possível extrair nenhum valor com confiança.");
    return ok(suggestions);
  } catch (err) {
    if (err instanceof AiDisabledError || err instanceof AiBudgetExceededError) return fail(err.message);
    return fail("Não foi possível preencher propriedades.");
  }
}

const applyPropertiesSchema = z.object({ values: z.record(z.string(), z.unknown()).refine((v) => Object.keys(v).length > 0, "Nenhum valor selecionado.") });

/**
 * "Preencher propriedades" (6.8) — passo 2: aplica só os valores mantidos na
 * revisão (mescla em `properties`, não substitui o objeto inteiro — outros
 * campos já preenchidos continuam intactos), com a mesma versão `reason: 'ai'`
 * dos outros assistentes que alteram o item.
 */
export async function applyFilledProperties(itemId: string, input: unknown): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const parsed = applyPropertiesSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Valores inválidos.");

  const { data: item } = await supabase.from("items").select("title, content, properties").eq("id", itemId).eq("owner_id", user.id).maybeSingle();
  if (!item) return fail("Item não encontrado.");

  const { error: versionError } = await supabase.from("item_versions").insert({
    owner_id: user.id,
    item_id: itemId,
    title: item.title,
    content: item.content,
    properties: item.properties,
    reason: "ai",
  });
  if (versionError) return fail("Não foi possível salvar a versão anterior.");

  const currentProperties = (item.properties as Record<string, unknown> | null) ?? {};
  const newProperties = { ...currentProperties, ...parsed.data.values };

  const { error: updateError } = await supabase
    .from("items")
    .update({ properties: newProperties as unknown as Json })
    .eq("id", itemId);
  if (updateError) return fail("Não foi possível aplicar os valores.");

  revalidatePath(`/itens/${itemId}`);
  return ok(null);
}

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

/**
 * "Organizar inbox" (6.8) — passo 1: uma chamada por item (schemas por item
 * variam pouco, mas o conteúdo é sempre diferente — mais simples e mais
 * confiável do que tentar encaixar vários itens numa saída estruturada só).
 * Erro de módulo desligado/orçamento estourado interrompe tudo (afeta os
 * itens ainda não processados); qualquer outro erro só pula aquele item,
 * sem derrubar as sugestões já geradas pros demais.
 */
export async function previewInboxOrganization(itemIds: string[]): Promise<Result<Record<string, InboxSuggestion>>> {
  const { supabase, user } = await requireOwner();
  if (itemIds.length === 0) return fail("Nenhum item selecionado.");

  const [itemsResult, spaces, types] = await Promise.all([
    supabase.from("items").select("id, title, content_text").in("id", itemIds).eq("owner_id", user.id),
    listActiveSpaces(supabase),
    listObjectTypesForPicker(supabase),
  ]);
  const items = itemsResult.data ?? [];
  if (items.length === 0) return fail("Nenhum item encontrado.");

  const spaceIds = new Set(spaces.map((space) => space.id));
  const typeIds = new Set(types.map((type) => type.id));
  const suggestions: Record<string, InboxSuggestion> = {};

  for (const item of items) {
    try {
      const raw = await callClaudeJson({
        ownerId: user.id,
        itemId: item.id,
        feature: "organize_inbox",
        system: ORGANIZE_INBOX_SYSTEM,
        schema: inboxSuggestionSchema,
        messages: [{ role: "user", content: buildOrganizeInboxUserMessage({ title: item.title, contentText: item.content_text }, spaces, types) }],
      });
      suggestions[item.id] = coerceInboxSuggestion(raw, spaceIds, typeIds);
    } catch (err) {
      if (err instanceof AiDisabledError || err instanceof AiBudgetExceededError) return fail(err.message);
      // erro de um item só (rede, parse) não derruba as sugestões já geradas
    }
  }

  if (Object.keys(suggestions).length === 0) return fail("Não foi possível gerar sugestões.");
  return ok(suggestions);
}

const applyInboxSuggestionSchema = z.object({
  itemId: z.string().uuid(),
  spaceId: z.string().uuid().nullable(),
  typeId: z.string().uuid().nullable(),
  tags: z.array(z.string().trim().min(1)).max(5),
  title: z.string().trim().min(1).nullable(),
});

/**
 * "Organizar inbox" (6.8) — passo 2, um item: reaproveita as actions já
 * existentes (`moveItems`/`changeItemType`/`addTagToItems`) em vez de mexer
 * direto na tabela — `changeItemType` já reconcilia `properties` com os
 * campos do novo tipo, uma lógica que não vale a pena duplicar aqui.
 */
export async function applyInboxOrganization(input: unknown): Promise<Result<null>> {
  const parsed = applyInboxSuggestionSchema.safeParse(input);
  if (!parsed.success) return fail("Sugestão inválida.");
  const { itemId, spaceId, typeId, tags, title } = parsed.data;

  if (spaceId) {
    const result = await moveItems([itemId], spaceId);
    if (!result.ok) return result;
  }
  if (typeId) {
    const result = await changeItemType(itemId, typeId);
    if (!result.ok) return result;
  }
  if (title) {
    const { supabase, user } = await requireOwner();
    const { error } = await supabase.from("items").update({ title }).eq("id", itemId).eq("owner_id", user.id);
    if (error) return fail("Não foi possível atualizar o título.");
  }
  for (const tag of tags) {
    const result = await addTagToItems([itemId], tag);
    if (!result.ok) return result;
  }

  revalidatePath("/inbox");
  return ok(null);
}

/** "Organizar inbox" (6.8) — "aplicar... em lote": mesma `applyInboxOrganization`, um item de cada vez, sem derrubar os demais se um falhar. */
export async function applyInboxOrganizationBatch(input: unknown): Promise<Result<{ count: number }>> {
  const parsed = z.array(applyInboxSuggestionSchema).min(1).safeParse(input);
  if (!parsed.success) return fail("Sugestões inválidas.");

  let count = 0;
  for (const entry of parsed.data) {
    const result = await applyInboxOrganization(entry);
    if (result.ok) count++;
  }

  if (count === 0) return fail("Não foi possível aplicar nenhuma sugestão.");
  return ok({ count });
}

/**
 * "Sugerir conexões" (6.8) — explicação curta do porquê, sob demanda (um
 * clique "Por quê?" por item, não automática ao abrir a página): gerar uma
 * explicação pra cada item de "Talvez relacionado" (6.6) sem que o dono peça
 * gastaria orçamento de IA só de olhar a página.
 */
export async function explainRelatedItem(itemId: string, relatedItemId: string): Promise<Result<string>> {
  const { supabase, user } = await requireOwner();

  const [currentResult, relatedResult] = await Promise.all([
    supabase.from("items").select("title, content_text").eq("id", itemId).eq("owner_id", user.id).maybeSingle(),
    supabase.from("items").select("title, content_text").eq("id", relatedItemId).eq("owner_id", user.id).maybeSingle(),
  ]);
  if (!currentResult.data || !relatedResult.data) return fail("Item não encontrado.");

  try {
    const { text } = await callClaude({
      ownerId: user.id,
      itemId,
      feature: "suggest_connection",
      system: SUGGEST_CONNECTION_SYSTEM,
      maxTokens: 120,
      messages: [
        {
          role: "user",
          content: buildSuggestConnectionMessage(
            { title: currentResult.data.title, contentText: currentResult.data.content_text },
            { title: relatedResult.data.title, contentText: relatedResult.data.content_text },
          ),
        },
      ],
    });
    return ok(text.trim());
  } catch (err) {
    if (err instanceof AiDisabledError || err instanceof AiBudgetExceededError) return fail(err.message);
    return fail("Não foi possível explicar a conexão.");
  }
}

const improveTextInputSchema = z
  .object({
    itemId: z.string().uuid(),
    text: z.string().trim().min(1).max(8000),
    action: z.enum(IMPROVE_TEXT_ACTIONS),
    targetLanguage: z.enum(TRANSLATE_LANGUAGES).optional(),
  })
  .refine((input) => input.action !== "traduzir" || input.targetLanguage, { message: "Escolha o idioma de destino.", path: ["targetLanguage"] });

/**
 * "Melhorar texto" (6.8) — sobre a seleção do editor: só devolve o texto
 * sugerido pra revisão (diff, no cliente); não mexe em nada no banco — quem
 * aplica é o próprio editor (`editor.commands...` na seleção), como uma
 * edição comum do dono, entrando no mesmo fluxo de salvar já existente.
 */
export async function improveSelectedText(input: unknown): Promise<Result<string>> {
  const { user } = await requireOwner();
  const parsed = improveTextInputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Não foi possível melhorar o texto.");

  try {
    const { text } = await callClaude({
      ownerId: user.id,
      itemId: parsed.data.itemId,
      feature: "improve_text",
      system: buildImproveTextSystem(parsed.data.action, parsed.data.targetLanguage),
      messages: [{ role: "user", content: parsed.data.text }],
    });
    return ok(text.trim());
  } catch (err) {
    if (err instanceof AiDisabledError || err instanceof AiBudgetExceededError) return fail(err.message);
    return fail("Não foi possível melhorar o texto.");
  }
}

/**
 * Versão do item salva antes de aplicar "Melhorar texto" (6.8, "criação de
 * versão reason='ai' antes de alterar conteúdo") — chamada pelo cliente
 * bem antes de `editor.commands...` substituir a seleção, já que essa
 * substituição não passa por nenhuma das outras actions desta tarefa.
 */
export async function saveVersionBeforeAiEdit(itemId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { data: item } = await supabase.from("items").select("title, content, properties").eq("id", itemId).eq("owner_id", user.id).maybeSingle();
  if (!item) return fail("Item não encontrado.");

  const { error } = await supabase.from("item_versions").insert({
    owner_id: user.id,
    item_id: itemId,
    title: item.title,
    content: item.content,
    properties: item.properties,
    reason: "ai",
  });
  if (error) return fail("Não foi possível salvar a versão anterior.");
  return ok(null);
}

/**
 * "Resumo semanal" (6.8, `/revisao-semanal`) — mesmos dados retrospectivos do
 * relatório `weekly_review` (6.2b: itens criados, tarefas concluídas,
 * reuniões, estudo, finanças se ligadas), últimos 7 dias, virando 3-6 frases
 * de destaque em vez de cards/tabela. Não grava nada — é só exibido; o dono
 * já tem "Notas livres da semana" (passo 6 da página) pra guardar o que quiser.
 */
export async function previewWeeklySummary(): Promise<Result<string>> {
  const { supabase, user } = await requireOwner();

  const ran = await runReport(weeklyReviewReport, supabase, user.id, { period: "last_7_days" });

  try {
    const { text } = await callClaude({
      ownerId: user.id,
      feature: "weekly_summary",
      system: WEEKLY_SUMMARY_SYSTEM,
      messages: [{ role: "user", content: buildWeeklySummaryMessage(ran.data, ran.periodStart, ran.periodEnd) }],
    });
    return ok(text.trim());
  } catch (err) {
    if (err instanceof AiDisabledError || err instanceof AiBudgetExceededError) return fail(err.message);
    return fail("Não foi possível gerar o resumo semanal.");
  }
}
