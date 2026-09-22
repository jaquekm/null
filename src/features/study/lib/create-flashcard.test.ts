import { describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fake-supabase";

const enqueueJobMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob: enqueueJobMock }));

const { createFlashcardWithReviewCard } = await import("./create-flashcard");

const OWNER_ID = "owner-1";
const TYPE_ID = "type-flashcard";

describe("createFlashcardWithReviewCard", () => {
  it("cria o item e o review_cards junto, com deck_item_id quando informado", async () => {
    const fake = new FakeSupabase({ review_cards: ["item_id"] });
    const result = await createFlashcardWithReviewCard(fake as never, OWNER_ID, {
      typeId: TYPE_ID,
      spaceId: "space-1",
      front: "Capital da França?",
      back: "Paris",
      deckItemId: "deck-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const items = fake.rowsOf("items");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ owner_id: OWNER_ID, type_id: TYPE_ID, title: "Capital da França?", status: "active" });
    expect(items[0]!.properties).toEqual({ front: "Capital da França?", back: "Paris", deck: ["deck-1"] });

    const cards = fake.rowsOf("review_cards");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ owner_id: OWNER_ID, item_id: result.data.itemId, deck_item_id: "deck-1" });

    expect(enqueueJobMock).toHaveBeenCalledWith(expect.objectContaining({ ownerId: OWNER_ID, kind: "run_automations" }));
  });

  it("sem baralho, não grava `deck` nas properties nem `deck_item_id`", async () => {
    const fake = new FakeSupabase({ review_cards: ["item_id"] });
    const result = await createFlashcardWithReviewCard(fake as never, OWNER_ID, {
      typeId: TYPE_ID,
      spaceId: null,
      front: "Pergunta",
      back: "Resposta",
      deckItemId: null,
    });

    expect(result.ok).toBe(true);
    expect(fake.rowsOf("items")[0]!.properties).toEqual({ front: "Pergunta", back: "Resposta" });
    expect(fake.rowsOf("review_cards")[0]).toMatchObject({ deck_item_id: null });
  });

  it("recusa frente ou verso vazios sem gravar nada", async () => {
    const fake = new FakeSupabase({ review_cards: ["item_id"] });
    const result = await createFlashcardWithReviewCard(fake as never, OWNER_ID, { typeId: TYPE_ID, spaceId: null, front: "  ", back: "x", deckItemId: null });

    expect(result.ok).toBe(false);
    expect(fake.rowsOf("items")).toHaveLength(0);
    expect(fake.rowsOf("review_cards")).toHaveLength(0);
  });

  it("título corta em 120 caracteres com reticências", async () => {
    const fake = new FakeSupabase({ review_cards: ["item_id"] });
    const front = "a".repeat(150);
    const result = await createFlashcardWithReviewCard(fake as never, OWNER_ID, { typeId: TYPE_ID, spaceId: null, front, back: "verso", deckItemId: null });

    expect(result.ok).toBe(true);
    expect(fake.rowsOf("items")[0]!.title).toBe(`${"a".repeat(117)}...`);
  });
});
