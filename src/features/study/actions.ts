"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { Grade } from "ts-fsrs";
import { AiBudgetExceededError, AiDisabledError, callClaudeJson } from "@/lib/ai/claude";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { parseAnkiExport } from "./lib/anki-import";
import { createFlashcardWithReviewCard } from "./lib/create-flashcard";
import { submitReview as applyCardReview } from "./lib/submit-review";
import { getItemContentText, getStudyTypeIds, listDeckCandidates, type DeckCandidate } from "./queries";
import {
  approveGeneratedFlashcardsSchema,
  createFlashcardSchema,
  generatedFlashcardsResponseSchema,
  generateFlashcardsSchema,
  type GeneratedFlashcard,
  importAnkiSchema,
  logStudySessionSchema,
  studySettingsSchema,
  submitReviewSchema,
  suspendCardSchema,
  updateFlashcardSidesSchema,
} from "./schemas";

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";
const PACK_NOT_INSTALLED = 'O pack "Estudos" ainda não está instalado.';

export async function createFlashcard(input: z.input<typeof createFlashcardSchema>): Promise<Result<{ itemId: string }>> {
  const parsed = createFlashcardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const typeIds = await getStudyTypeIds(supabase);
  if (!typeIds) return fail(PACK_NOT_INSTALLED);

  const result = await createFlashcardWithReviewCard(supabase, user.id, {
    typeId: typeIds.flashcardTypeId,
    spaceId: parsed.data.spaceId,
    front: parsed.data.front,
    back: parsed.data.back,
    deckItemId: parsed.data.deckItemId,
  });
  if (result.ok) revalidatePath("/estudos");
  return result;
}

/** "Editar durante a revisão" (5.7). */
export async function updateFlashcardSides(input: z.input<typeof updateFlashcardSidesSchema>): Promise<Result<null>> {
  const parsed = updateFlashcardSidesSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const { data: current, error: readError } = await supabase
    .from("items")
    .select("properties")
    .eq("id", parsed.data.itemId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (readError || !current) return fail(GENERIC_ERROR);

  const properties = { ...((current.properties as Record<string, unknown> | null) ?? {}), front: parsed.data.front, back: parsed.data.back };
  const { error } = await supabase
    .from("items")
    .update({ properties: properties as unknown as Json })
    .eq("id", parsed.data.itemId)
    .eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);
  return ok(null);
}

export async function submitReview(input: z.input<typeof submitReviewSchema>): Promise<Result<{ dueAt: string }>> {
  const parsed = submitReviewSchema.safeParse(input);
  if (!parsed.success) return fail(GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const result = await applyCardReview(supabase, user.id, {
    cardId: parsed.data.cardId,
    grade: parsed.data.grade as Grade,
    now: new Date(),
    durationMs: parsed.data.durationMs,
  });
  if (result.ok) revalidatePath("/estudos/revisar");
  return result;
}

export async function suspendCard(input: z.input<typeof suspendCardSchema>): Promise<Result<null>> {
  const parsed = suspendCardSchema.safeParse(input);
  if (!parsed.success) return fail(GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const { error } = await supabase.from("review_cards").update({ suspended: parsed.data.suspended }).eq("id", parsed.data.cardId).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);
  revalidatePath("/estudos/revisar");
  return ok(null);
}

export async function importAnkiCards(input: z.input<typeof importAnkiSchema>): Promise<Result<{ created: number; skipped: number }>> {
  const parsed = importAnkiSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const typeIds = await getStudyTypeIds(supabase);
  if (!typeIds) return fail(PACK_NOT_INSTALLED);

  const cards = parseAnkiExport(parsed.data.text);
  if (cards.length === 0) return fail("Nenhum card reconhecido no conteúdo colado (formato esperado: frente;verso, um por linha).");

  let created = 0;
  for (const card of cards) {
    const result = await createFlashcardWithReviewCard(supabase, user.id, {
      typeId: typeIds.flashcardTypeId,
      spaceId: parsed.data.spaceId,
      front: card.front,
      back: card.back,
      deckItemId: parsed.data.deckItemId,
    });
    if (result.ok) created += 1;
  }
  revalidatePath("/estudos");
  return ok({ created, skipped: cards.length - created });
}

function buildFlashcardGenerationPrompt(maxCards: number): string {
  return (
    "Você cria flashcards de estudo (repetição espaçada) a partir de um texto em português do Brasil (nota, transcrição de aula ou documento). " +
    "Gere perguntas objetivas, uma ideia por card — nunca junte vários conceitos num card só. Evite cards triviais (coisas óbvias que não exigem memorização). " +
    `Gere no máximo ${maxCards} cards — só os que fizerem sentido a partir do conteúdo, pode gerar menos se o texto for curto. ` +
    'Responda em JSON: um array de objetos com exatamente as chaves "front" (a pergunta/estímulo) e "back" (a resposta).'
  );
}

/** "Gerar flashcards com IA" (5.7): só devolve os cards gerados pra revisão — não cria nada ainda (aprovação em `approveGeneratedFlashcards`). */
export async function generateFlashcardsFromItem(input: z.input<typeof generateFlashcardsSchema>): Promise<Result<GeneratedFlashcard[]>> {
  const parsed = generateFlashcardsSchema.safeParse(input);
  if (!parsed.success) return fail(GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const source = await getItemContentText(supabase, user.id, parsed.data.sourceItemId);
  if (!source) return fail("Item de origem não encontrado.");
  if (!source.contentText.trim()) return fail("Esse item não tem conteúdo de texto pra gerar flashcards.");

  try {
    const cards = await callClaudeJson({
      ownerId: user.id,
      feature: "flashcard_generation",
      itemId: parsed.data.sourceItemId,
      system: buildFlashcardGenerationPrompt(parsed.data.maxCards),
      messages: [{ role: "user", content: `Título: ${source.title}\n\n${source.contentText}` }],
      schema: generatedFlashcardsResponseSchema,
    });
    if (cards.length === 0) return fail("Não deu pra gerar nenhum flashcard a partir desse conteúdo.");
    return ok(cards);
  } catch (err) {
    if (err instanceof AiDisabledError || err instanceof AiBudgetExceededError) return fail(err.message);
    return fail("Não foi possível gerar os flashcards. Tente de novo.");
  }
}

export async function approveGeneratedFlashcards(input: z.input<typeof approveGeneratedFlashcardsSchema>): Promise<Result<{ created: number }>> {
  const parsed = approveGeneratedFlashcardsSchema.safeParse(input);
  if (!parsed.success) return fail(GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const typeIds = await getStudyTypeIds(supabase);
  if (!typeIds) return fail(PACK_NOT_INSTALLED);

  let created = 0;
  for (const card of parsed.data.cards) {
    const result = await createFlashcardWithReviewCard(supabase, user.id, {
      typeId: typeIds.flashcardTypeId,
      spaceId: parsed.data.spaceId,
      front: card.front,
      back: card.back,
      deckItemId: parsed.data.deckItemId,
    });
    if (result.ok) created += 1;
  }
  revalidatePath("/estudos");
  return ok({ created });
}

export async function logStudySession(input: z.input<typeof logStudySessionSchema>): Promise<Result<null>> {
  const parsed = logStudySessionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const { error } = await supabase.from("study_sessions").insert({
    owner_id: user.id,
    item_id: parsed.data.itemId,
    kind: parsed.data.kind,
    started_at: parsed.data.startedAt,
    ended_at: parsed.data.endedAt,
    duration_minutes: parsed.data.durationMinutes,
    notes: parsed.data.notes ?? null,
  });
  if (error) return fail(GENERIC_ERROR);
  revalidatePath("/estudos");
  return ok(null);
}

export async function setStudySettings(input: z.input<typeof studySettingsSchema>): Promise<Result<null>> {
  const parsed = studySettingsSchema.safeParse(input);
  if (!parsed.success) return fail(GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const { data: current } = await supabase.from("user_settings").select("preferences").eq("owner_id", user.id).maybeSingle();
  const preferences = { ...((current?.preferences as Record<string, unknown> | null) ?? {}), study: parsed.data };

  const { error } = await supabase.from("user_settings").upsert({ owner_id: user.id, preferences: preferences as unknown as Json }, { onConflict: "owner_id" });
  if (error) return fail(GENERIC_ERROR);
  revalidatePath("/estudos/revisar");
  return ok(null);
}

export async function searchDeckCandidates(): Promise<DeckCandidate[]> {
  const { supabase } = await requireOwner();
  const typeIds = await getStudyTypeIds(supabase);
  if (!typeIds) return [];
  return listDeckCandidates(supabase, typeIds);
}

/** Seletor de item de origem pra "Gerar flashcards com IA" (mesmo `search_items` da busca geral, como o seletor de itens do Canvas na 5.5). */
export async function searchSourceItems(query: string): Promise<{ id: string; title: string }[]> {
  const { supabase } = await requireOwner();
  if (!query.trim()) return [];
  const { data, error } = await supabase.rpc("search_items", { q: query, p_limit: 12 });
  if (error || !data) return [];
  return data.map((row) => ({ id: row.id, title: row.title }));
}
