import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface ManualItemRow {
  id: string;
  title: string;
  updatedAt: string;
}

/** Itens já gerados do manual (7.10) — espaço "Hub", tipo "Documento". Vazio antes do primeiro "Gerar manual". */
export async function listManualItems(supabase: Client, ownerId: string): Promise<ManualItemRow[]> {
  const { data: space } = await supabase.from("spaces").select("id").eq("owner_id", ownerId).eq("slug", "hub").maybeSingle();
  if (!space) return [];

  const { data: documentType } = await supabase.from("object_types").select("id").eq("owner_id", ownerId).eq("slug", "documento").maybeSingle();
  if (!documentType) return [];

  const { data, error } = await supabase
    .from("items")
    .select("id, title, updated_at")
    .eq("owner_id", ownerId)
    .eq("space_id", space.id)
    .eq("type_id", documentType.id)
    .is("deleted_at", null)
    .order("title", { ascending: true });
  if (error) throw error;

  return data.map((item) => ({ id: item.id, title: item.title, updatedAt: item.updated_at }));
}
