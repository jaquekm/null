import "server-only";
import type { JSONContent } from "@tiptap/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { diffLinks } from "./diff-links";
import { extractContactMentionIds } from "./extract-contact-mention-ids";

type Client = SupabaseClient<Database>;

/** Marca as linhas de `item_contacts` criadas pela menção `@` no editor (3.3) — distingue de vínculos adicionados por outro caminho (ex.: campo `contact` de um tipo). */
const MENTION_ROLE = "mention";

/**
 * Sincroniza `item_contacts` com as menções `@contato` do conteúdo (3.3) —
 * mesmo padrão de `updateItemContent`/`restoreItemVersion` pra menções de
 * item (`links`, `kind='mention'`, 1.7), chamado a partir dos dois lugares
 * que salvam `content` de um item.
 */
export async function syncContactMentions(
  supabase: Client,
  ownerId: string,
  itemId: string,
  content: JSONContent | null,
): Promise<void> {
  const { data: existing, error } = await supabase
    .from("item_contacts")
    .select("contact_id")
    .eq("item_id", itemId)
    .eq("role", MENTION_ROLE);
  if (error) return;

  const currentIds = existing.map((row) => row.contact_id);
  const nextIds = extractContactMentionIds(content);
  const { add, remove } = diffLinks(currentIds, nextIds);

  if (remove.length > 0) {
    await supabase.from("item_contacts").delete().eq("item_id", itemId).eq("role", MENTION_ROLE).in("contact_id", remove);
  }
  if (add.length > 0) {
    await supabase.from("item_contacts").insert(
      add.map((contactId) => ({ owner_id: ownerId, item_id: itemId, contact_id: contactId, role: MENTION_ROLE })),
    );
  }
}
