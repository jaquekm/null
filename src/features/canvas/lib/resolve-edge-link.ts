export interface CanvasNodeRef {
  kind: string;
  itemId: string | null;
}

export interface ResolvedLink {
  sourceItemId: string;
  targetItemId: string;
}

/**
 * Uma aresta com `creates_link` (5.5) só vira um `links` de verdade
 * (`kind='canvas'`) quando os dois nós que ela conecta são nós de **item**
 * — os outros tipos (texto, grupo, imagem, link, contato) não têm um item
 * pra ligar. A ordem sai como está na aresta (source → target), igual à
 * direção de `links.source_id`/`target_id`.
 */
export function resolveEdgeLink(source: CanvasNodeRef, target: CanvasNodeRef): ResolvedLink | null {
  if (source.kind !== "item" || target.kind !== "item") return null;
  if (!source.itemId || !target.itemId) return null;
  if (source.itemId === target.itemId) return null;
  return { sourceItemId: source.itemId, targetItemId: target.itemId };
}
