import { parseHashtags } from "@/features/tags/lib/parse-hashtags";
import type { TagOption } from "@/features/tags/queries";

export interface ExtractedQuery {
  /** Texto sem o token `#tag` reconhecido, pronto pra ir pra busca em texto. */
  text: string;
  /** Id da primeira tag reconhecida no texto que bate com uma tag existente. */
  tagId: string | null;
}

/**
 * Busca por tag na caixa de texto (1.14): reconhece o primeiro `#tag` que
 * corresponda a uma tag existente, tira o token do texto (senão a busca por
 * texto ia procurar a palavra da tag também, e itens marcados com a tag mas
 * que não citam o nome dela no conteúdo não apareceriam) e devolve o id da
 * tag pra filtrar por `p_tag_id` em `search_items`.
 */
export function extractTagFilter(rawQuery: string, tags: TagOption[]): ExtractedQuery {
  const names = parseHashtags(rawQuery);
  const tagByName = new Map(tags.map((tag) => [tag.name.toLowerCase(), tag]));
  const matchedName = names.find((name) => tagByName.has(name));

  if (!matchedName) return { text: rawQuery.trim(), tagId: null };

  const tag = tagByName.get(matchedName);
  if (!tag) return { text: rawQuery.trim(), tagId: null };

  const withoutTag = rawQuery.replace(new RegExp(`#${matchedName}`, "iu"), "").trim();
  return { text: withoutTag, tagId: tag.id };
}
