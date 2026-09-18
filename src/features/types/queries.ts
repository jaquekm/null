import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { FieldDefinition } from "./schemas";

type Client = SupabaseClient<Database>;

export interface ObjectTypeListRow {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  spaceId: string | null;
  spaceName: string | null;
  itemCount: number;
}

export async function listObjectTypesWithCounts(supabase: Client): Promise<ObjectTypeListRow[]> {
  const [{ data: types, error: typesError }, { data: spaces, error: spacesError }, { data: items, error: itemsError }] =
    await Promise.all([
      supabase
        .from("object_types")
        .select("id, name, slug, icon, space_id, position")
        .is("archived_at", null)
        .order("position", { ascending: true }),
      supabase.from("spaces").select("id, name"),
      supabase.from("items").select("type_id").is("deleted_at", null).not("type_id", "is", null),
    ]);

  if (typesError) throw typesError;
  if (spacesError) throw spacesError;
  if (itemsError) throw itemsError;

  const spaceNames = new Map(spaces.map((s) => [s.id, s.name]));
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.type_id) continue;
    counts.set(item.type_id, (counts.get(item.type_id) ?? 0) + 1);
  }

  return types.map((type) => ({
    id: type.id,
    name: type.name,
    slug: type.slug,
    icon: type.icon,
    spaceId: type.space_id,
    spaceName: type.space_id ? (spaceNames.get(type.space_id) ?? null) : null,
    itemCount: counts.get(type.id) ?? 0,
  }));
}

export interface ObjectTypeDetail {
  id: string;
  name: string;
  pluralName: string | null;
  slug: string;
  icon: string | null;
  color: string | null;
  spaceId: string | null;
  defaultView: string;
  titleTemplate: string | null;
  isSystem: boolean;
  fields: FieldDefinition[];
}

export async function getObjectTypeBySlug(supabase: Client, slug: string): Promise<ObjectTypeDetail | null> {
  const { data, error } = await supabase
    .from("object_types")
    .select("id, name, plural_name, slug, icon, color, space_id, default_view, title_template, is_system, fields")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    pluralName: data.plural_name,
    slug: data.slug,
    icon: data.icon,
    color: data.color,
    spaceId: data.space_id,
    defaultView: data.default_view,
    titleTemplate: data.title_template,
    isSystem: data.is_system,
    fields: (data.fields as unknown as FieldDefinition[] | null) ?? [],
  };
}

export async function listOtherObjectTypes(supabase: Client, excludeId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("object_types")
    .select("id, name")
    .is("archived_at", null)
    .neq("id", excludeId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}
