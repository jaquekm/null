export interface BoxNode {
  x: number;
  y: number;
  width: number | null;
  height: number | null;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 80;
const GROUP_PADDING = 24;

/**
 * Bounding box de um conjunto de nós, com uma margem — usado pra dimensionar
 * o nó `group` recém-criado ao "Agrupar" a seleção (5.5). Um nó que nunca
 * foi redimensionado ainda não tem `width`/`height` salvo — usa um tamanho
 * padrão de card só pra estimar a moldura; o React Flow remede o tamanho
 * real assim que os nós entram no grupo.
 */
export function computeBoundingBox(nodes: BoxNode[]): Box {
  if (nodes.length === 0) throw new Error("computeBoundingBox precisa de ao menos um nó.");

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const width = node.width ?? DEFAULT_WIDTH;
    const height = node.height ?? DEFAULT_HEIGHT;
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + width);
    maxY = Math.max(maxY, node.y + height);
  }

  return {
    x: minX - GROUP_PADDING,
    y: minY - GROUP_PADDING,
    width: maxX - minX + GROUP_PADDING * 2,
    height: maxY - minY + GROUP_PADDING * 2,
  };
}
