import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachHashtagsFromText } from "@/features/tags/lib/attach-hashtags";
import type { Database, Json } from "@/lib/supabase/database.types";
import { textToDoc } from "./text-to-doc";

export interface CreateCaptureInput {
  ownerId: string;
  title: string;
  body: string;
  spaceId: string | null;
  typeId: string | null;
  source: string;
  sourceUrl?: string | null;
}

/**
 * Núcleo da captura rápida (1.10), compartilhado pelo diálogo/página dentro
 * do app e por `POST /api/capture`: cria o item (inbox se não vier espaço,
 * `active` se vier) e anexa as `#tags` do texto.
 */
export async function createCaptureItem(
  supabase: SupabaseClient<Database>,
  input: CreateCaptureInput,
): Promise<{ id: string } | null> {
  const contentDoc = input.body ? textToDoc(input.body) : null;

  const { data, error } = await supabase
    .from("items")
    .insert({
      owner_id: input.ownerId,
      title: input.title,
      content: contentDoc as unknown as Json | null,
      content_text: input.body,
      space_id: input.spaceId,
      type_id: input.typeId,
      status: input.spaceId ? "active" : "inbox",
      source: input.source,
      source_url: input.sourceUrl ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return null;

  await attachHashtagsFromText(supabase, input.ownerId, data.id, `${input.title} ${input.body}`);

  return { id: data.id };
}
