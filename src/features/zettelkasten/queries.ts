import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getObjectTypeBySlug } from "@/features/types/queries";
import { findOrphanNoteIds, type NoteForOrphanCheck } from "./lib/find-orphan-notes";

type Client = SupabaseClient<Database>;

export interface ZettelkastenTypeIds {
  permanentNoteTypeId: string;
  literaryNoteTypeId: string | null;
}

/** `null`: pack PARA/Zettelkasten/GTD não instalado — página mostra o convite pra instalar (mesmo padrão de `/estudos`). */
export async function getZettelkastenTypeIds(supabase: Client): Promise<ZettelkastenTypeIds | null> {
  const permanentNote = await getObjectTypeBySlug(supabase, "nota-permanente");
  if (!permanentNote) return null;
  const literaryNote = await getObjectTypeBySlug(supabase, "nota-literaria");
  return { permanentNoteTypeId: permanentNote.id, literaryNoteTypeId: literaryNote?.id ?? null };
}

export interface OrphanNote {
  id: string;
  title: string;
}

function outgoingIdsOf(properties: Record<string, unknown> | null): string[] {
  const sources = properties?.sources;
  const source = properties?.source;
  return [...(Array.isArray(sources) ? sources : []), ...(Array.isArray(source) ? source : [])].filter((id): id is string => typeof id === "string");
}

/** "Notas sem links, pra conectar" (5.11, Zettelkasten) — busca Nota permanente + Nota literária e aplica `findOrphanNoteIds` (puro). */
export async function listOrphanNotes(supabase: Client, ownerId: string, typeIds: ZettelkastenTypeIds): Promise<OrphanNote[]> {
  const ids = [typeIds.permanentNoteTypeId, typeIds.literaryNoteTypeId].filter((id): id is string => Boolean(id));
  const { data } = await supabase.from("items").select("id, title, properties").eq("owner_id", ownerId).in("type_id", ids).is("deleted_at", null);

  const notes: (NoteForOrphanCheck & { title: string })[] = (data ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    outgoingIds: outgoingIdsOf(item.properties as Record<string, unknown> | null),
  }));

  const orphanIds = new Set(findOrphanNoteIds(notes));
  return notes.filter((note) => orphanIds.has(note.id)).map((note) => ({ id: note.id, title: note.title }));
}
