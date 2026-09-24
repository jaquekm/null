import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { ExistingItemForDuplicateCheck } from "./lib/detect-duplicates";
import type { ImportSource } from "./types";

type Client = SupabaseClient<Database>;

/** Itens já existentes no espaço de destino — alimenta a detecção de duplicados e a resolução de `[[wikilinks]]` que apontam pra uma nota que já existia antes deste lote. */
export async function listExistingItemsInSpace(supabase: Client, ownerId: string, spaceId: string | null): Promise<ExistingItemForDuplicateCheck[]> {
  let query = supabase.from("items").select("id, title, created_at").eq("owner_id", ownerId).is("deleted_at", null);
  query = spaceId ? query.eq("space_id", spaceId) : query.is("space_id", null);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, createdAt: row.created_at }));
}

/** Cria (ou reaproveita) uma tag por nome, em lote — mesmo idioma de `addTagToItem`/`addTagToItems` (1.8/1.13), só que numa consulta só pra todos os nomes distintos do lote. */
export async function bulkUpsertTags(supabase: Client, ownerId: string, names: string[]): Promise<Map<string, string>> {
  const distinctNames = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))];
  if (distinctNames.length === 0) return new Map();

  const { data, error } = await supabase
    .from("tags")
    .upsert(
      distinctNames.map((name) => ({ owner_id: ownerId, name })),
      { onConflict: "owner_id,name" },
    )
    .select("id, name");
  if (error) throw error;
  return new Map(data.map((tag) => [tag.name, tag.id]));
}

export async function linkTagsToItems(supabase: Client, ownerId: string, links: { itemId: string; tagId: string }[]): Promise<void> {
  if (links.length === 0) return;
  const { error } = await supabase.from("item_tags").upsert(
    links.map((l) => ({ owner_id: ownerId, item_id: l.itemId, tag_id: l.tagId })),
    { onConflict: "item_id,tag_id" },
  );
  if (error) throw error;
}

export interface CreateImportedItemInput {
  ownerId: string;
  importBatchId: string;
  spaceId: string | null;
  typeId: string | null;
  title: string;
  content: Json;
  contentText: string;
  createdAt: string | null;
}

/** Cria um item importado — `properties._import_id` é o que permite desfazer o lote depois (7.5). `source: "import"` já é um valor aceito pela coluna desde a fundação. */
export async function createImportedItem(supabase: Client, input: CreateImportedItemInput): Promise<{ id: string; createdAt: string; updatedAt: string }> {
  const { data, error } = await supabase
    .from("items")
    .insert({
      owner_id: input.ownerId,
      space_id: input.spaceId,
      type_id: input.typeId,
      title: input.title || "Sem título",
      content: input.content,
      content_text: input.contentText,
      properties: { _import_id: input.importBatchId } as Json,
      status: "active",
      source: "import",
      created_at: input.createdAt ?? undefined,
    })
    .select("id, created_at, updated_at")
    .single();
  if (error || !data) throw error ?? new Error("Falha ao criar item importado.");
  return { id: data.id, createdAt: data.created_at, updatedAt: data.updated_at };
}

export async function updateImportedItemContent(supabase: Client, itemId: string, content: Json, contentText: string): Promise<void> {
  const { error } = await supabase.from("items").update({ content, content_text: contentText }).eq("id", itemId);
  if (error) throw error;
}

export interface SaveImportBatchInput {
  ownerId: string;
  id: string;
  source: ImportSource | "ics";
  itemsCreated: number;
  itemsSkipped: number;
  detail?: Json;
}

export async function saveImportBatch(supabase: Client, input: SaveImportBatchInput): Promise<void> {
  const { error } = await supabase.from("import_batches").insert({
    id: input.id,
    owner_id: input.ownerId,
    source: input.source,
    items_created: input.itemsCreated,
    items_skipped: input.itemsSkipped,
    detail: input.detail ?? null,
  });
  if (error) throw error;
}

export interface ImportBatchRow {
  id: string;
  source: string;
  status: "imported" | "undone";
  itemsCreated: number;
  itemsSkipped: number;
  detail: Json | null;
  createdAt: string;
}

export async function getImportBatch(supabase: Client, ownerId: string, id: string): Promise<ImportBatchRow | null> {
  const { data, error } = await supabase.from("import_batches").select("*").eq("owner_id", ownerId).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    source: data.source,
    status: data.status as "imported" | "undone",
    itemsCreated: data.items_created,
    itemsSkipped: data.items_skipped,
    detail: data.detail,
    createdAt: data.created_at,
  };
}

/**
 * Desfaz um lote de itens (7.5): só remove (soft-delete, igual à lixeira)
 * quem não foi editado **pelo dono** desde a importação — mesmo critério de
 * segurança de `undoImport` nas finanças (4.5), só que comparado contra
 * `import_batches.created_at` (quando o lote terminou de gravar), não
 * contra o próprio `created_at` do item: um item importado pode legitimamente
 * ter `created_at` bem mais antigo que `updated_at` (data de criação
 * original da nota, preservada na importação) sem que isso signifique que o
 * dono mexeu nele depois — e a segunda passada de `[[wikilinks]]` também
 * grava um `update` a mais durante o próprio commit, antes do lote existir.
 */
export async function undoItemImportBatch(supabase: Client, ownerId: string, batchId: string, batchCreatedAt: string): Promise<{ removed: number; kept: number }> {
  const { data: items, error } = await supabase
    .from("items")
    .select("id, updated_at")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .contains("properties", { _import_id: batchId });
  if (error) throw error;

  const untouched = (items ?? []).filter((item) => item.updated_at <= batchCreatedAt).map((item) => item.id);
  const kept = (items ?? []).length - untouched.length;

  if (untouched.length > 0) {
    const { error: deleteError } = await supabase.from("items").update({ deleted_at: new Date().toISOString() }).in("id", untouched);
    if (deleteError) throw deleteError;
  }

  await supabase.from("import_batches").update({ status: "undone" }).eq("owner_id", ownerId).eq("id", batchId);

  return { removed: untouched.length, kept };
}

const IMPORTED_CALENDAR_EXTERNAL_ID = "local-imported";

/** Calendário local "Importado" (7.5, `.ics`) — sem `connection_id` (nada de Google por trás), `sync_enabled: false` pra `calendar_sync` nunca tentar sincronizá-lo. Uma linha só por dono, reaproveitada em toda importação de `.ics`. */
export async function ensureImportedCalendar(supabase: Client, ownerId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("calendars")
    .select("id")
    .eq("owner_id", ownerId)
    .is("connection_id", null)
    .eq("external_id", IMPORTED_CALENDAR_EXTERNAL_ID)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("calendars")
    .insert({ owner_id: ownerId, connection_id: null, external_id: IMPORTED_CALENDAR_EXTERNAL_ID, name: "Importado", sync_enabled: false })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Falha ao criar o calendário Importado.");
  return data.id;
}

export interface CreateIcsEventInput {
  ownerId: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  status: "confirmed" | "tentative" | "cancelled";
}

export async function insertIcsEvents(supabase: Client, events: CreateIcsEventInput[]): Promise<string[]> {
  if (events.length === 0) return [];
  const { data, error } = await supabase
    .from("events")
    .insert(
      events.map((e) => ({
        owner_id: e.ownerId,
        calendar_id: e.calendarId,
        title: e.title,
        description: e.description,
        location: e.location,
        starts_at: e.startsAt,
        ends_at: e.endsAt,
        all_day: e.allDay,
        status: e.status,
      })),
    )
    .select("id");
  if (error) throw error;
  return data.map((row) => row.id);
}

export async function undoIcsImportBatch(supabase: Client, ownerId: string, batch: ImportBatchRow): Promise<number> {
  const eventIds = Array.isArray((batch.detail as { eventIds?: unknown } | null)?.eventIds) ? ((batch.detail as { eventIds: string[] }).eventIds ?? []) : [];
  if (eventIds.length === 0) return 0;

  const { error, count } = await supabase.from("events").delete({ count: "exact" }).eq("owner_id", ownerId).in("id", eventIds);
  if (error) throw error;

  await supabase.from("import_batches").update({ status: "undone" }).eq("owner_id", ownerId).eq("id", batch.id);
  return count ?? eventIds.length;
}
