import "server-only";
import type { JSONContent } from "@tiptap/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchAttendeesToContactIds } from "@/features/events/lib/match-attendees-to-contacts";
import { extractText } from "@/features/items/lib/extract-text";
import { fail, ok, type Result } from "@/lib/result";
import type { Database, Json } from "@/lib/supabase/database.types";
import { DATA_FIELD_KEY, getReuniaoType, listMeetingItemsForLookup, listPendingActions, PARTICIPANTES_FIELD_KEY } from "../queries";
import { buildMeetingNoteContent } from "./build-meeting-note-content";
import { findPreviousMeeting } from "./find-previous-meeting";

type Client = SupabaseClient<Database>;

export interface MeetingNoteResult {
  itemId: string;
  alreadyExisted: boolean;
}

/**
 * Núcleo de "Criar nota da reunião" (3.7) — chamado tanto pelo botão manual
 * (`actions.ts`) quanto pelo job `prepare_meeting_notes`, por isso recebe
 * `supabase`/`ownerId` em vez de resolver a sessão sozinho (o job não tem
 * sessão de usuário).
 */
export async function createMeetingNoteForEvent(supabase: Client, ownerId: string, eventId: string): Promise<Result<MeetingNoteResult>> {
  const { data: event } = await supabase
    .from("events")
    .select("id, title, starts_at, attendees, conference_url, item_id, calendar_id")
    .eq("id", eventId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!event) return fail("Evento não encontrado.");
  if (event.item_id) return ok({ itemId: event.item_id, alreadyExisted: true });

  const reuniaoType = await getReuniaoType(supabase, ownerId);
  if (!reuniaoType) return fail('Tipo "Reunião" não encontrado.');

  let spaceId: string | null = null;
  if (event.calendar_id) {
    const { data: calendar } = await supabase.from("calendars").select("space_id").eq("id", event.calendar_id).maybeSingle();
    spaceId = calendar?.space_id ?? null;
  }

  const attendees = Array.isArray(event.attendees) ? (event.attendees as { email?: unknown }[]) : [];
  const attendeeEmails = attendees.filter((a): a is { email: string } => typeof a.email === "string");
  const { data: contacts } = await supabase.from("contacts").select("id, email").eq("owner_id", ownerId);
  const participantIds = matchAttendeesToContactIds(attendeeEmails, contacts ?? []);

  const meetings = await listMeetingItemsForLookup(supabase, ownerId, reuniaoType.id);
  const previous = findPreviousMeeting(meetings, participantIds);
  const pendingActions = previous ? await listPendingActions(supabase, ownerId, previous.id) : [];

  const content = buildMeetingNoteContent(
    reuniaoType.template as unknown as JSONContent | null,
    event.conference_url,
    previous ? { id: previous.id, title: previous.title, pendingActions } : null,
  );

  const { data: newItem, error: insertError } = await supabase
    .from("items")
    .insert({
      owner_id: ownerId,
      space_id: spaceId,
      type_id: reuniaoType.id,
      title: event.title,
      status: "active",
      properties: { [DATA_FIELD_KEY]: event.starts_at, [PARTICIPANTES_FIELD_KEY]: participantIds } as unknown as Json,
      content: content as unknown as Json,
      content_text: extractText(content),
    })
    .select("id")
    .single();
  if (insertError || !newItem) return fail("Não foi possível criar a nota da reunião.");

  await supabase.from("events").update({ item_id: newItem.id }).eq("id", eventId);

  return ok({ itemId: newItem.id, alreadyExisted: false });
}
