import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JSONContent } from "@tiptap/core";
import type { Database } from "@/lib/supabase/database.types";
import type { FieldDefinition } from "@/features/types/schemas";
import type { TagOption } from "@/features/tags/queries";

type Client = SupabaseClient<Database>;

export interface ItemDetail {
  id: string;
  title: string;
  status: string;
  pinned: boolean;
  parentId: string | null;
  updatedAt: string;
  createdAt: string;
  space: { id: string; name: string; slug: string; icon: string | null } | null;
  type: { id: string; name: string; slug: string; fields: FieldDefinition[] } | null;
  properties: Record<string, unknown>;
  content: JSONContent | null;
}

export async function getItemDetail(supabase: Client, id: string): Promise<ItemDetail | null> {
  const { data, error } = await supabase
    .from("items")
    .select(
      "id, title, status, pinned, parent_id, updated_at, created_at, properties, content, spaces(id, name, slug, icon), object_types(id, name, slug, fields)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    status: data.status,
    pinned: data.pinned,
    parentId: data.parent_id,
    updatedAt: data.updated_at,
    createdAt: data.created_at,
    content: (data.content as unknown as JSONContent | null) ?? null,
    space: data.spaces,
    type: data.object_types
      ? {
          id: data.object_types.id,
          name: data.object_types.name,
          slug: data.object_types.slug,
          fields: (data.object_types.fields as unknown as FieldDefinition[] | null) ?? [],
        }
      : null,
    properties: (data.properties as Record<string, unknown> | null) ?? {},
  };
}

export interface SubitemRow {
  id: string;
  title: string;
  status: string;
}

export async function listSubitems(supabase: Client, parentId: string): Promise<SubitemRow[]> {
  const { data, error } = await supabase
    .from("items")
    .select("id, title, status")
    .eq("parent_id", parentId)
    .is("deleted_at", null)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export interface ParentRow {
  id: string;
  title: string;
}

export async function getParent(supabase: Client, parentId: string): Promise<ParentRow | null> {
  const { data, error } = await supabase.from("items").select("id, title").eq("id", parentId).maybeSingle();
  if (error) throw error;
  return data;
}

export interface BacklinkRow {
  id: string;
  title: string;
  kind: string;
  updated_at: string;
}

export async function listBacklinks(supabase: Client, itemId: string): Promise<BacklinkRow[]> {
  const { data, error } = await supabase.rpc("item_backlinks", { p_item_id: itemId });
  if (error) throw error;
  return data;
}

export interface ItemVersionRow {
  id: string;
  title: string;
  reason: string;
  createdAt: string;
}

export async function listItemVersions(supabase: Client, itemId: string): Promise<ItemVersionRow[]> {
  const { data, error } = await supabase
    .from("item_versions")
    .select("id, title, reason, created_at")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data.map((v) => ({ id: v.id, title: v.title, reason: v.reason, createdAt: v.created_at }));
}

export interface TypeOptionWithFields {
  id: string;
  name: string;
  fields: FieldDefinition[];
}

export async function listObjectTypesForPicker(supabase: Client): Promise<TypeOptionWithFields[]> {
  const { data, error } = await supabase
    .from("object_types")
    .select("id, name, fields")
    .is("archived_at", null)
    .order("position", { ascending: true });
  if (error) throw error;
  return data.map((t) => ({ id: t.id, name: t.name, fields: (t.fields as unknown as FieldDefinition[] | null) ?? [] }));
}

export interface InboxItemRow {
  id: string;
  title: string;
  /** `content_text` normalizado (sem quebras de linha), texto completo — a linha corta na exibição, o modo processamento mostra tudo. */
  contentText: string;
  source: string | null;
  spaceId: string | null;
  typeId: string | null;
  createdAt: string;
  updatedAt: string;
  tags: TagOption[];
}

/** Itens do inbox (1.13), mais recentes primeiro (data de captura). */
export async function listInboxItems(supabase: Client): Promise<InboxItemRow[]> {
  const { data, error } = await supabase
    .from("items")
    .select("id, title, content_text, source, space_id, type_id, created_at, updated_at")
    .eq("status", "inbox")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (data.length === 0) return [];

  const ids = data.map((item) => item.id);
  const { data: itemTags, error: tagsError } = await supabase
    .from("item_tags")
    .select("item_id, tags(id, name, color)")
    .in("item_id", ids);
  if (tagsError) throw tagsError;

  const tagsByItem = new Map<string, TagOption[]>();
  for (const row of itemTags) {
    if (!row.tags) continue;
    const list = tagsByItem.get(row.item_id) ?? [];
    list.push(row.tags);
    tagsByItem.set(row.item_id, list);
  }

  return data.map((item) => ({
    id: item.id,
    title: item.title,
    contentText: item.content_text.replace(/\s+/g, " ").trim(),
    source: item.source,
    spaceId: item.space_id,
    typeId: item.type_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    tags: tagsByItem.get(item.id) ?? [],
  }));
}

/** Contador do inbox (badge na sidebar, 1.13). */
export async function countInboxItems(supabase: Client): Promise<number> {
  const { count, error } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("status", "inbox")
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}

export interface BrowseItemRow {
  id: string;
  title: string;
  spaceId: string | null;
  typeId: string | null;
  updatedAt: string;
}

/** Itens fixados — mostrados na busca (1.14) quando a caixa de texto está vazia. */
export async function listPinnedItems(supabase: Client, limit = 8): Promise<BrowseItemRow[]> {
  const { data, error } = await supabase
    .from("items")
    .select("id, title, space_id, type_id, updated_at")
    .eq("pinned", true)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((item) => ({ id: item.id, title: item.title, spaceId: item.space_id, typeId: item.type_id, updatedAt: item.updated_at }));
}

/** Itens recentes — mostrados na busca (1.14) quando a caixa de texto está vazia. */
export async function listRecentItems(supabase: Client, limit = 8): Promise<BrowseItemRow[]> {
  const { data, error } = await supabase
    .from("items")
    .select("id, title, space_id, type_id, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((item) => ({ id: item.id, title: item.title, spaceId: item.space_id, typeId: item.type_id, updatedAt: item.updated_at }));
}

export interface TrashedItemRow {
  id: string;
  title: string;
  deletedAt: string;
}

export async function listTrashedItems(supabase: Client): Promise<TrashedItemRow[]> {
  const { data, error } = await supabase
    .from("items")
    .select("id, title, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return data.map((i) => ({ id: i.id, title: i.title, deletedAt: i.deleted_at! }));
}
