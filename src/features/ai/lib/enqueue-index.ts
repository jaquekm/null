import "server-only";
import { enqueueJob } from "@/lib/jobs/enqueue";

/** Debounce (6.5): `runAfter` 2 min no futuro — várias edições seguidas do mesmo item ficam atrás do mesmo `dedupeKey` (a fila ignora silenciosamente o enfileiramento repetido enquanto o job ainda está pendente), então digitar não empilha uma execução por tecla. */
const DEBOUNCE_MINUTES = 2;

/**
 * Enfileira `index_item` (6.5) — chamado depois de qualquer mudança em
 * conteúdo indexável de um item: salvar título/propriedades/conteúdo
 * (`features/items/actions.ts`), fim de transcrição (`applyTranscriptionResult`)
 * e fim de extração de anexo (`extract-attachment.ts`). O job sempre relê o
 * item do banco na hora que roda — não carrega um snapshot — então o
 * `runAfter` só controla "daqui a quanto tempo", nunca o que será indexado.
 */
export async function enqueueIndexItem(ownerId: string, itemId: string): Promise<void> {
  await enqueueJob({
    ownerId,
    kind: "index_item",
    payload: { itemId },
    dedupeKey: `index:${itemId}`,
    runAfter: new Date(Date.now() + DEBOUNCE_MINUTES * 60_000),
  });
}
