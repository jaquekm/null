import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

const CANVAS_TYPE_SLUG = "canvas";

export interface CanvasRow {
  id: string;
  itemId: string;
  viewport: { x: number; y: number; zoom: number };
  settings: Record<string, unknown>;
}

function mapCanvas(row: { id: string; item_id: string; viewport: Json; settings: Json }): CanvasRow {
  const viewport = row.viewport as unknown as { x: number; y: number; zoom: number };
  return {
    id: row.id,
    itemId: row.item_id,
    viewport: { x: viewport?.x ?? 0, y: viewport?.y ?? 0, zoom: viewport?.zoom ?? 1 },
    settings: (row.settings as Record<string, unknown> | null) ?? {},
  };
}

/**
 * Garante que o tipo de sistema "Canvas" existe pro dono (5.5). É criado no
 * onboarding pra quem se cadastra dali pra frente (`SYSTEM_TYPE_SEEDS`), mas
 * quem já passou pelo onboarding antes desta fase não ganha o tipo
 * retroativamente (mesma limitação já documentada pros jobs agendados no
 * onboarding financeiro, 4.7/4.8/4.11) — por isso todo caminho que cria um
 * item Canvas passa por aqui primeiro, que cria o tipo na hora se faltar.
 */
export async function ensureCanvasType(supabase: Client, ownerId: string): Promise<{ id: string }> {
  const { data: existing, error } = await supabase
    .from("object_types")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("slug", CANVAS_TYPE_SLUG)
    .maybeSingle();
  if (error) throw error;
  if (existing) return { id: existing.id };

  const { data, error: insertError } = await supabase
    .from("object_types")
    .insert({
      owner_id: ownerId,
      slug: CANVAS_TYPE_SLUG,
      name: "Canvas",
      plural_name: "Canvas",
      icon: "🗺️",
      is_system: true,
      default_view: "list",
      fields: [] as unknown as Json,
    })
    .select("id")
    .single();
  if (insertError || !data) throw insertError ?? new Error("Falha ao criar o tipo Canvas.");
  return { id: data.id };
}

/** Busca (ou, na primeira abertura, cria) o canvas de um item — `canvases.item_id` é único (5.1). */
export async function ensureCanvas(supabase: Client, ownerId: string, itemId: string): Promise<CanvasRow> {
  const { data: existing, error } = await supabase
    .from("canvases")
    .select("id, item_id, viewport, settings")
    .eq("item_id", itemId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return mapCanvas(existing);

  const { data, error: insertError } = await supabase
    .from("canvases")
    .insert({ owner_id: ownerId, item_id: itemId })
    .select("id, item_id, viewport, settings")
    .single();
  if (insertError || !data) throw insertError ?? new Error("Falha ao criar o canvas.");
  return mapCanvas(data);
}

export interface CanvasNodeRow {
  id: string;
  kind: string;
  itemId: string | null;
  contactId: string | null;
  attachmentId: string | null;
  data: Record<string, unknown>;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  parentNodeId: string | null;
  style: Record<string, unknown>;
  zIndex: number;
  /** Resolvidos pra exibição — não moram na própria linha de `canvas_nodes`. */
  itemTitle: string | null;
  itemIcon: string | null;
  itemTypeSlug: string | null;
  contactName: string | null;
}

interface ItemSummary {
  title: string;
  icon: string | null;
  typeSlug: string | null;
}

async function fetchItemSummaries(supabase: Client, ids: string[]): Promise<Map<string, ItemSummary>> {
  const { data, error } = await supabase.from("items").select("id, title, object_types(icon, slug)").in("id", ids);
  if (error) throw error;
  const map = new Map<string, ItemSummary>();
  for (const row of data ?? []) {
    const type = row.object_types as unknown as { icon: string | null; slug: string } | null;
    map.set(row.id, { title: row.title || "Sem título", icon: type?.icon ?? null, typeSlug: type?.slug ?? null });
  }
  return map;
}

async function fetchContactNames(supabase: Client, ids: string[]): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("contacts").select("id, name, nickname").in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.id, row.nickname || row.name]));
}

export async function listCanvasNodes(supabase: Client, canvasId: string): Promise<CanvasNodeRow[]> {
  const { data, error } = await supabase.from("canvas_nodes").select("*").eq("canvas_id", canvasId).order("z_index", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];

  const itemIds = [...new Set(rows.filter((row) => row.item_id).map((row) => row.item_id as string))];
  const contactIds = [...new Set(rows.filter((row) => row.contact_id).map((row) => row.contact_id as string))];

  const [itemsById, contactsById] = await Promise.all([
    itemIds.length > 0 ? fetchItemSummaries(supabase, itemIds) : Promise.resolve(new Map<string, ItemSummary>()),
    contactIds.length > 0 ? fetchContactNames(supabase, contactIds) : Promise.resolve(new Map<string, string>()),
  ]);

  return rows.map((row) => {
    const item = row.item_id ? itemsById.get(row.item_id) : undefined;
    return {
      id: row.id,
      kind: row.kind,
      itemId: row.item_id,
      contactId: row.contact_id,
      attachmentId: row.attachment_id,
      data: (row.data as Record<string, unknown> | null) ?? {},
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      parentNodeId: row.parent_node_id,
      style: (row.style as Record<string, unknown> | null) ?? {},
      zIndex: row.z_index,
      itemTitle: item?.title ?? null,
      itemIcon: item?.icon ?? null,
      itemTypeSlug: item?.typeSlug ?? null,
      contactName: row.contact_id ? (contactsById.get(row.contact_id) ?? null) : null,
    };
  });
}

export interface CanvasEdgeRow {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string | null;
  style: Record<string, unknown>;
  createsLink: boolean;
}

export async function listCanvasEdges(supabase: Client, canvasId: string): Promise<CanvasEdgeRow[]> {
  const { data, error } = await supabase
    .from("canvas_edges")
    .select("id, source_node_id, target_node_id, label, style, creates_link")
    .eq("canvas_id", canvasId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    label: row.label,
    style: (row.style as Record<string, unknown> | null) ?? {},
    createsLink: row.creates_link,
  }));
}

export interface CanvasRef {
  canvasId: string;
  canvasItemId: string;
  canvasItemTitle: string;
}

/** "Aparece nos canvases" (5.5) — canvases onde este item aparece como um nó de item. */
export async function listCanvasesContainingItem(supabase: Client, itemId: string): Promise<CanvasRef[]> {
  const { data, error } = await supabase
    .from("canvas_nodes")
    .select("canvas_id, canvases(item_id, items(id, title))")
    .eq("item_id", itemId)
    .eq("kind", "item");
  if (error) throw error;

  const seen = new Set<string>();
  const refs: CanvasRef[] = [];
  for (const row of data ?? []) {
    const canvas = row.canvases as unknown as { item_id: string; items: { id: string; title: string } | null } | null;
    if (!canvas?.items || seen.has(row.canvas_id)) continue;
    seen.add(row.canvas_id);
    refs.push({ canvasId: row.canvas_id, canvasItemId: canvas.items.id, canvasItemTitle: canvas.items.title || "Sem título" });
  }
  return refs;
}

export interface CanvasItemSearchResult {
  id: string;
  title: string;
}

/** Busca lateral do canvas (5.5) — reaproveita `search_items` (1.1), como a menção `[[` do editor (1.7). */
export async function searchItemsForCanvas(supabase: Client, query: string): Promise<CanvasItemSearchResult[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase.rpc("search_items", { q: query, p_limit: 12 });
  if (error || !data) return [];
  return data.map((row) => ({ id: row.id, title: row.title }));
}
