import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { parseHashtags } from "./parse-hashtags";

type Client = SupabaseClient<Database>;

/**
 * `#palavra` no título vira tag (1.8): cria a tag se não existir e anexa ao
 * item. Best-effort — um erro pontual numa tag não derruba o salvamento do
 * título que chamou isto.
 */
export async function attachHashtagsFromText(
  supabase: Client,
  ownerId: string,
  itemId: string,
  text: string,
): Promise<void> {
  const tagNames = parseHashtags(text);
  if (tagNames.length === 0) return;

  for (const name of tagNames) {
    const { data: tag } = await supabase
      .from("tags")
      .upsert({ owner_id: ownerId, name }, { onConflict: "owner_id,name" })
      .select("id")
      .single();

    if (tag) {
      await supabase
        .from("item_tags")
        .upsert({ item_id: itemId, tag_id: tag.id, owner_id: ownerId }, { onConflict: "item_id,tag_id" });
    }
  }
}
