import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { MeetingItemForLookup } from "./lib/find-previous-meeting";

type Client = SupabaseClient<Database>;

const REUNIAO_SLUG = "reuniao";
const DATA_FIELD_KEY = "data";
const PARTICIPANTES_FIELD_KEY = "participantes";

export interface ReuniaoType {
  id: string;
  template: Json | null;
}

/** O tipo sistema "Reunião" (1.3) — a 3.7 assume que ele existe e usa `data`/`participantes` por chave (estáveis desde o seed). */
export async function getReuniaoType(supabase: Client, ownerId: string): Promise<ReuniaoType | null> {
  const { data, error } = await supabase
    .from("object_types")
    .select("id, template")
    .eq("owner_id", ownerId)
    .eq("slug", REUNIAO_SLUG)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/** Toda reunião (menos as excluídas) do dono, com os ids de contato em `participantes` — pra achar a "última reunião com estes participantes" (3.7) em JS. */
export async function listMeetingItemsForLookup(supabase: Client, ownerId: string, reuniaoTypeId: string): Promise<MeetingItemForLookup[]> {
  const { data, error } = await supabase
    .from("items")
    .select("id, title, created_at, properties")
    .eq("owner_id", ownerId)
    .eq("type_id", reuniaoTypeId)
    .is("deleted_at", null);
  if (error || !data) return [];
  return data.map((item) => {
    const properties = (item.properties as Record<string, unknown> | null) ?? {};
    const participantes = properties[PARTICIPANTES_FIELD_KEY];
    return {
      id: item.id,
      title: item.title,
      createdAt: item.created_at,
      participantIds: Array.isArray(participantes) ? participantes.filter((id): id is string => typeof id === "string") : [],
    };
  });
}

export interface PendingAction {
  id: string;
  title: string;
}

/** Subitens de uma reunião que ainda não foram marcados "Feito" (campo `status`, quando o tipo do subitem tiver um) — as "ações pendentes" da 3.7. */
export async function listPendingActions(supabase: Client, ownerId: string, meetingItemId: string): Promise<PendingAction[]> {
  const { data, error } = await supabase
    .from("items")
    .select("id, title, properties")
    .eq("owner_id", ownerId)
    .eq("parent_id", meetingItemId)
    .is("deleted_at", null);
  if (error || !data) return [];
  return data
    .filter((item) => (item.properties as Record<string, unknown> | null)?.status !== "done")
    .map((item) => ({ id: item.id, title: item.title }));
}

export { DATA_FIELD_KEY, PARTICIPANTES_FIELD_KEY };
