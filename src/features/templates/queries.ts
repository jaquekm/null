import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/** Slugs de todos os tipos ativos da dona — decide quais modelos do "+ Novo" aparecem (9.2). */
export async function listOwnerTypeSlugs(supabase: Client): Promise<string[]> {
  const { data, error } = await supabase.from("object_types").select("slug").is("archived_at", null);
  if (error) throw error;
  return [...new Set(data.map((row) => row.slug))];
}
