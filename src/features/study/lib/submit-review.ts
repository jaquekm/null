import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Grade } from "ts-fsrs";
import { fail, ok, type Result } from "@/lib/result";
import type { Database } from "@/lib/supabase/database.types";
import { applyGrade, type ReviewCardFsrsRow } from "./fsrs";

type Client = SupabaseClient<Database>;
const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";

export interface SubmitReviewInput {
  cardId: string;
  grade: Grade;
  now: Date;
  durationMs: number | null;
}

/** Grava uma avaliação (Errei/Difícil/Bom/Fácil, 5.7): aplica o FSRS, atualiza `review_cards` e grava `review_logs`. */
export async function submitReview(supabase: Client, ownerId: string, input: SubmitReviewInput): Promise<Result<{ dueAt: string }>> {
  const { data: card, error } = await supabase
    .from("review_cards")
    .select("id, state, due_at, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, last_review_at, suspended")
    .eq("id", input.cardId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) return fail(GENERIC_ERROR);
  if (!card) return fail("Card não encontrado.");
  if (card.suspended) return fail("Esse card está suspenso — reative pra revisar de novo.");

  const row: ReviewCardFsrsRow = {
    state: card.state,
    due_at: card.due_at,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    last_review_at: card.last_review_at,
  };
  const applied = applyGrade(row, input.grade, input.now);

  const { error: updateError } = await supabase.from("review_cards").update(applied.cardPatch).eq("id", input.cardId).eq("owner_id", ownerId);
  if (updateError) return fail(GENERIC_ERROR);

  const { error: logError } = await supabase.from("review_logs").insert({
    owner_id: ownerId,
    card_id: input.cardId,
    rating: applied.log.rating,
    state_before: applied.log.stateBefore,
    due_before: applied.log.dueBefore,
    stability_after: applied.log.stabilityAfter,
    difficulty_after: applied.log.difficultyAfter,
    duration_ms: input.durationMs,
    reviewed_at: input.now.toISOString(),
  });
  if (logError) return fail(GENERIC_ERROR);

  return ok({ dueAt: applied.cardPatch.due_at });
}
