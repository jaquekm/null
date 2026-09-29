import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { listStyleFor, type BrowserItem, type BrowserTag } from "./lib/space-browser";

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

export interface DocumentToReview {
  id: string;
  title: string;
  revisarEm: string;
}

/**
 * Painel "Documentos a revisar" (5.10, pack Mudanças/decisões — mas o campo
 * `revisar_em` já é do tipo de sistema Documento desde o onboarding, então
 * este painel funciona mesmo sem o pack instalado): itens do tipo Documento
 * neste espaço cuja `revisar_em` já chegou.
 */
export async function listDocumentsToReview(supabase: Client, ownerId: string, spaceId: string, todayDateStr: string): Promise<DocumentToReview[]> {
  const { data: documentType } = await supabase.from("object_types").select("id").eq("owner_id", ownerId).eq("slug", "documento").maybeSingle();
  if (!documentType) return [];

  const { data } = await supabase
    .from("items")
    .select("id, title, properties")
    .eq("owner_id", ownerId)
    .eq("space_id", spaceId)
    .eq("type_id", documentType.id)
    .is("deleted_at", null);

  return (data ?? [])
    .map((item) => ({ id: item.id, title: item.title, revisarEm: (item.properties as Record<string, unknown> | null)?.revisar_em as string | undefined }))
    .filter((item): item is DocumentToReview => typeof item.revisarEm === "string" && item.revisarEm <= todayDateStr)
    .sort((a, b) => a.revisarEm.localeCompare(b.revisarEm));
}

/** Teto de itens carregados de uma vez na página do espaço — os filtros rodam no navegador, sem ida ao servidor a cada clique. */
const BROWSER_LIMIT = 1000;

/**
 * Itens do espaço pra busca com filtros (tipo, subcategoria = tag, tipo de
 * lista): só o necessário pra listar e filtrar, sem conteúdo. Arquivados e
 * excluídos ficam de fora, como nas visões.
 */
export async function listSpaceBrowserItems(supabase: Client, spaceId: string): Promise<BrowserItem[]> {
  const [itemsResult, tagsResult] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, type_id, updated_at, list_style:properties->>list_style, object_types(name, icon, slug)")
      .eq("space_id", spaceId)
      .is("deleted_at", null)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(BROWSER_LIMIT),
    supabase.from("item_tags").select("item_id, tags(id, name, color), items!inner(space_id)").eq("items.space_id", spaceId),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (tagsResult.error) throw tagsResult.error;

  const tagsByItem = new Map<string, BrowserTag[]>();
  for (const row of tagsResult.data) {
    if (!row.tags) continue;
    tagsByItem.set(row.item_id, [...(tagsByItem.get(row.item_id) ?? []), row.tags]);
  }

  return itemsResult.data.map((row) => ({
    id: row.id,
    title: row.title,
    typeId: row.type_id,
    typeName: row.object_types?.name ?? null,
    typeIcon: row.object_types?.icon ?? null,
    typeSlug: row.object_types?.slug ?? null,
    listStyle: listStyleFor(row.object_types?.slug ?? null, row.list_style),
    tags: (tagsByItem.get(row.id) ?? []).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    updatedAt: row.updated_at,
  }));
}
