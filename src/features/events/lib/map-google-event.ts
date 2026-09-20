import type { GoogleCalendarEvent, GoogleEventDateTime } from "@/lib/google/calendar";

export interface MappedEventFields {
  external_id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  timezone: string | null;
  status: string;
  attendees: { email: string; name: string | null; response: string | null }[];
  recurring_event_external_id: string | null;
  remote_etag: string;
  remote_updated_at: string | null;
  conference_url: string | null;
}

const ALLOWED_STATUSES = new Set(["confirmed", "tentative", "cancelled"]);

function toInstant(value: GoogleEventDateTime | undefined): { instant: string; allDay: boolean; timeZone: string | null } {
  if (value?.dateTime) {
    return { instant: new Date(value.dateTime).toISOString(), allDay: false, timeZone: value.timeZone ?? null };
  }
  if (value?.date) {
    // Evento de dia inteiro: só a data, sem fuso — guardamos como meia-noite UTC
    // daquele dia (a exibição por `all_day=true`, não pelo horário, é da 3.6).
    return { instant: new Date(`${value.date}T00:00:00.000Z`).toISOString(), allDay: true, timeZone: null };
  }
  throw new Error("Evento do Google sem `start`/`end` (nem `dateTime`, nem `date`).");
}

/**
 * Google → linha de `events` (3.5), função pura e testada. `attendees` segue
 * o formato documentado na migration (`[{ email, name, response }]`).
 */
export function mapGoogleEventToRow(event: GoogleCalendarEvent): MappedEventFields {
  const start = toInstant(event.start);
  const end = toInstant(event.end);

  return {
    external_id: event.id,
    title: event.summary?.trim() || "(sem título)",
    description: event.description ?? null,
    location: event.location ?? null,
    starts_at: start.instant,
    ends_at: end.instant,
    all_day: start.allDay,
    timezone: start.timeZone,
    status: ALLOWED_STATUSES.has(event.status) ? event.status : "confirmed",
    attendees: (event.attendees ?? []).map((attendee) => ({
      email: attendee.email,
      name: attendee.displayName ?? null,
      response: attendee.responseStatus ?? null,
    })),
    recurring_event_external_id: event.recurringEventId ?? null,
    remote_etag: event.etag,
    remote_updated_at: event.updated ?? null,
    conference_url: event.hangoutLink ?? null,
  };
}
