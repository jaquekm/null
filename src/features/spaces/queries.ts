import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface SidebarSpace {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  position: number;
}

export async function listActiveSpaces(supabase: Client): Promise<SidebarSpace[]> {
  const { data, error } = await supabase
    .from("spaces")
    .select("id, name, slug, icon, color, position")
    .is("archived_at", null)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getSpaceBySlug(supabase: Client, slug: string) {
  const { data, error } = await supabase
    .from("spaces")
    .select("id, name, slug, icon, color, description, position, archived_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listOtherActiveSpaces(supabase: Client, excludeId: string): Promise<SidebarSpace[]> {
  const { data, error } = await supabase
    .from("spaces")
    .select("id, name, slug, icon, color, position")
    .is("archived_at", null)
    .neq("id", excludeId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function countActiveItemsInSpace(supabase: Client, spaceId: string): Promise<number> {
  const { count, error } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("space_id", spaceId)
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}

export interface SpaceTypeOption {
  id: string;
  name: string;
  slug: string;
}

/** Tipos disponíveis num espaço: globais (`space_id = null`) + os específicos dele. */
export async function listSpaceObjectTypes(supabase: Client, spaceId: string): Promise<SpaceTypeOption[]> {
  const { data, error } = await supabase
    .from("object_types")
    .select("id, name, slug, space_id")
    .is("archived_at", null)
    .or(`space_id.is.null,space_id.eq.${spaceId}`)
    .order("position", { ascending: true });
  if (error) throw error;
  return data.map(({ id, name, slug }) => ({ id, name, slug }));
}

export interface SpaceItemRow {
  id: string;
  title: string;
  status: string;
  type_id: string | null;
  updated_at: string;
}

export async function listSpaceItems(
  supabase: Client,
  spaceId: string,
  filters: { typeId?: string; itemIds?: string[] } = {},
): Promise<SpaceItemRow[]> {
  let query = supabase
    .from("items")
    .select("id, title, status, type_id, updated_at")
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (filters.typeId) {
    query = query.eq("type_id", filters.typeId);
  }
  if (filters.itemIds) {
    query = query.in("id", filters.itemIds.length > 0 ? filters.itemIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
