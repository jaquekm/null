"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { fail, ok, type Result } from "@/lib/result";
import { createRelatedLink, listActiveItemIds } from "./queries";

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
