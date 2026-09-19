import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface TagOption {
  id: string;
  name: string;
  color: string | null;
}

export interface TagWithCount extends TagOption {
  itemCount: number;
}

export async function listTagsWithCounts(supabase: Client): Promise<TagWithCount[]> {
  const [{ data: tags, error: tagsError }, { data: itemTags, error: itemTagsError }] = await Promise.all([
    supabase.from("tags").select("id, name, color").order("name", { ascending: true }),
    supabase.from("item_tags").select("tag_id"),
  ]);
  if (tagsError) throw tagsError;
  if (itemTagsError) throw itemTagsError;

  const counts = new Map<string, number>();
  for (const row of itemTags) {
    counts.set(row.tag_id, (counts.get(row.tag_id) ?? 0) + 1);
  }

  return tags.map((tag) => ({ ...tag, itemCount: counts.get(tag.id) ?? 0 }));
}

export async function listAllTags(supabase: Client): Promise<TagOption[]> {
  const { data, error } = await supabase.from("tags").select("id, name, color").order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listItemTags(supabase: Client, itemId: string): Promise<TagOption[]> {
  const { data, error } = await supabase.from("item_tags").select("tags(id, name, color)").eq("item_id", itemId);
  if (error) throw error;
  return data.map((row) => row.tags).filter((tag): tag is TagOption => Boolean(tag));
}

/**
 * Tags de vários itens de uma vez, agrupadas por `item_id` — usada por
 * qualquer lista de itens que precisa mostrar tags sem uma consulta por
 * linha (Inbox 1.13, Visões 1.15).
 */
export async function listTagsByItemIds(supabase: Client, itemIds: string[]): Promise<Map<string, TagOption[]>> {
  const tagsByItem = new Map<string, TagOption[]>();
  if (itemIds.length === 0) return tagsByItem;

  const { data, error } = await supabase.from("item_tags").select("item_id, tags(id, name, color)").in("item_id", itemIds);
  if (error) throw error;

  for (const row of data) {
    if (!row.tags) continue;
    const list = tagsByItem.get(row.item_id) ?? [];
    list.push(row.tags);
    tagsByItem.set(row.item_id, list);
  }
  return tagsByItem;
}
