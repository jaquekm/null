import { Rating } from "ts-fsrs";
import { describe, expect, it } from "vitest";
import { FakeSupabase } from "@/lib/testing/fake-supabase";
import { submitReview } from "./submit-review";

const OWNER_ID = "owner-1";
const NOW = new Date("2026-09-22T12:00:00.000Z");

function seedNewCard(fake: FakeSupabase, overrides: Record<string, unknown> = {}) {
  fake.seed("review_cards", [
    {
      id: "card-1",
      owner_id: OWNER_ID,
      item_id: "item-1",
      deck_item_id: null,
      state: "new",
      due_at: NOW.toISOString(),
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      last_review_at: null,
      suspended: false,
      ...overrides,
    },
  ]);
}

describe("submitReview", () => {
  it("avalia um card novo com Bom: state vira review, due_at avança, grava o log", async () => {
    const fake = new FakeSupabase();
    seedNewCard(fake);

    const result = await submitReview(fake as never, OWNER_ID, { cardId: "card-1", grade: Rating.Good, now: NOW, durationMs: 4200 });
    expect(result.ok).toBe(true);

    const card = fake.rowsOf("review_cards")[0]!;
    expect(card.state).toBe("review");
    expect(new Date(card.due_at as string).getTime()).toBeGreaterThan(NOW.getTime());
    expect(card.reps).toBe(1);
    expect(card.lapses).toBe(0);

    const logs = fake.rowsOf("review_logs");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      owner_id: OWNER_ID,
      card_id: "card-1",
      rating: Rating.Good,
      state_before: "new",
      due_before: NOW.toISOString(),
      duration_ms: 4200,
    });
  });

  it("Errei num card já maduro soma lapses e mantém o state em review (enable_short_term:false)", async () => {
    const fake = new FakeSupabase();
    seedNewCard(fake, { state: "review", stability: 50, difficulty: 5, reps: 3, lapses: 0, last_review_at: "2026-08-01T12:00:00.000Z" });

    const result = await submitReview(fake as never, OWNER_ID, { cardId: "card-1", grade: Rating.Again, now: NOW, durationMs: null });
    expect(result.ok).toBe(true);

    const card = fake.rowsOf("review_cards")[0]!;
    expect(card.state).toBe("review");
    expect(card.lapses).toBe(1);
  });

  it("recusa card suspenso", async () => {
    const fake = new FakeSupabase();
    seedNewCard(fake, { suspended: true });

    const result = await submitReview(fake as never, OWNER_ID, { cardId: "card-1", grade: Rating.Good, now: NOW, durationMs: null });
    expect(result.ok).toBe(false);
    expect(fake.rowsOf("review_logs")).toHaveLength(0);
  });

  it("recusa card de outro dono", async () => {
    const fake = new FakeSupabase();
    seedNewCard(fake);

    const result = await submitReview(fake as never, "outro-dono", { cardId: "card-1", grade: Rating.Good, now: NOW, durationMs: null });
    expect(result.ok).toBe(false);
  });
});
