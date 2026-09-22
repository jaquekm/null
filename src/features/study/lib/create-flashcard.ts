import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emitItemEvent } from "@/features/automations/lib/emit-item-event";
import { fail, ok, type Result } from "@/lib/result";
import type { Database, Json } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";

export interface CreateFlashcardInput {
  typeId: string;
  spaceId: string | null;
  front: string;
  back: string;
  deckItemId: string | null;
}

/**
 * "Ao criar item Flashcard → criar `review_cards`" (5.7). A ação genérica de
 * automação `create_review_cards` (5.3) faz o caminho contrário — um item
 * (baralho) cria cards pros itens JÁ LIGADOS a ele — então não serve aqui:
 * o Flashcard ainda não existe no momento em que precisaria disparar. Em vez
 * de esticar o motor de automações por causa de um pack, esta função cria o
 * item e o card junto (mesmo padrão de `createCanvasItem` na 5.5), com o
 * card nascendo com os defaults da tabela (`state='new'`, `due_at=now()`,
 * `stability/difficulty/elapsed_days/scheduled_days=0`) — exatamente o
 * "empty card" que o `ts-fsrs` geraria, então não precisa chamar
 * `createEmptyCard()` à toa.
 *
 * Gap aceito e documentado (PROGRESSO.md): um Flashcard criado pelo seletor
 * genérico de itens (fora deste caminho) fica sem `review_cards` — mesma
 * categoria de gap já registrada na 5.6 pros limites do motor de automações.
 */
export async function createFlashcardWithReviewCard(supabase: Client, ownerId: string, input: CreateFlashcardInput): Promise<Result<{ itemId: string }>> {
  const front = input.front.trim();
  const back = input.back.trim();
  if (!front || !back) return fail("Preencha a frente e o verso do card.");

  const title = front.length > 120 ? `${front.slice(0, 117)}...` : front;
  const properties: Record<string, unknown> = { front, back, ...(input.deckItemId ? { deck: [input.deckItemId] } : {}) };

  const { data: item, error } = await supabase
    .from("items")
    .insert({ owner_id: ownerId, space_id: input.spaceId, type_id: input.typeId, title, status: "active", properties: properties as unknown as Json })
    .select("id")
    .single();
  if (error || !item) return fail(GENERIC_ERROR);

  const { error: cardError } = await supabase.from("review_cards").insert({ owner_id: ownerId, item_id: item.id, deck_item_id: input.deckItemId });
  if (cardError) return fail(GENERIC_ERROR);

  await emitItemEvent({ ownerId, itemId: item.id, before: null, after: { status: "active", properties } });

  return ok({ itemId: item.id });
}
