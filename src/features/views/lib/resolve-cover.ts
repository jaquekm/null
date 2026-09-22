import type { JSONContent } from "@tiptap/core";

function findFirstImageSrc(node: JSONContent): string | null {
  if (node.type === "image" && typeof node.attrs?.src === "string") return node.attrs.src;
  for (const child of node.content ?? []) {
    const found = findFirstImageSrc(child);
    if (found) return found;
  }
  return null;
}

/**
 * Capa do card na Galeria (5.4): `cover_path` do item se tiver, senão a
 * primeira imagem do conteúdo (`src` já é a URL estável de anexo,
 * `/api/attachments/[id]/file` — ver `extensions.ts` do editor, 1.9).
 * `null` quando não há nenhuma das duas — o card mostra um placeholder.
 */
export function resolveCoverSrc(coverPath: string | null, content: JSONContent | null): string | null {
  if (coverPath) return coverPath;
  if (!content) return null;
  return findFirstImageSrc(content);
}
