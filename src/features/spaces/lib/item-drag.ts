/**
 * Arrastar um item da lista do espaço até um espaço da barra lateral (pedido da dona,
 * 12/11: item criado no lugar errado não tinha como ser movido). Usa o arrastar nativo
 * do navegador — a linha e a barra lateral são árvores separadas, então não dá pra
 * compartilhar um `DndContext` — e o tipo próprio abaixo identifica que é um item do
 * JKode (e não um link, arquivo ou texto qualquer).
 */
export const ITEM_DRAG_TYPE = "application/x-jkode-item";

export interface DraggedItem {
  id: string;
  title: string;
}

/** Lido no `dragover`: nesse momento o navegador só deixa ver os tipos, não o conteúdo. */
export function hasItemDrag(dataTransfer: Pick<DataTransfer, "types"> | null | undefined): boolean {
  return Boolean(dataTransfer && Array.from(dataTransfer.types ?? []).includes(ITEM_DRAG_TYPE));
}

export function writeDraggedItem(dataTransfer: Pick<DataTransfer, "setData"> & { effectAllowed: string }, item: DraggedItem): void {
  dataTransfer.setData(ITEM_DRAG_TYPE, JSON.stringify(item));
  dataTransfer.effectAllowed = "move";
}

/** Lido no `drop`. Conteúdo estragado ou de outra origem vira `null`. */
export function readDraggedItem(dataTransfer: Pick<DataTransfer, "getData"> | null | undefined): DraggedItem | null {
  if (!dataTransfer) return null;
  try {
    const parsed: unknown = JSON.parse(dataTransfer.getData(ITEM_DRAG_TYPE));
    if (!parsed || typeof parsed !== "object") return null;
    const { id, title } = parsed as Record<string, unknown>;
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    return { id, title: typeof title === "string" ? title : "" };
  } catch {
    return null;
  }
}
