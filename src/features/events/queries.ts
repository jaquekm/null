import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface EventDetailForEdit {
  id: string;
  calendarId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  attendeeEmails: string[];
  itemId: string | null;
}

/** Detalhe de um evento pro diálogo de edição (3.6) — só o que o formulário precisa reabrir preenchido. */
export async function getEventDetailForEdit(supabase: Client, eventId: string, ownerId: string): Promise<EventDetailForEdit | null> {
  const { data, error } = await supabase
    .from("events")
    .select("id, calendar_id, title, description, location, starts_at, ends_at, all_day, attendees, item_id")
    .eq("id", eventId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error || !data) return null;

  const attendees = Array.isArray(data.attendees) ? (data.attendees as { email?: unknown }[]) : [];
  const attendeeEmails = attendees.map((attendee) => attendee.email).filter((email): email is string => typeof email === "string");

  return {
    id: data.id,
    calendarId: data.calendar_id,
    title: data.title,
    description: data.description,
    location: data.location,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    allDay: data.all_day,
    attendeeEmails,
    itemId: data.item_id,
  };
}
