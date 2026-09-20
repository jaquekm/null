import type { GoogleEventDateTime, GoogleEventInput } from "@/lib/google/calendar";

export interface EventRowForPush {
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  timezone: string | null;
  attendees: unknown;
}

function toGoogleDateTime(instantIso: string, allDay: boolean, timezone: string | null): GoogleEventDateTime {
  if (allDay) return { date: instantIso.slice(0, 10) };
  return { dateTime: instantIso, timeZone: timezone ?? undefined };
}

function extractAttendeeEmails(attendees: unknown): string[] {
  if (!Array.isArray(attendees)) return [];
  return attendees
    .map((attendee) => (attendee && typeof attendee === "object" ? (attendee as { email?: unknown }).email : undefined))
    .filter((email): email is string => typeof email === "string");
}

/**
 * Linha de `events` → entrada da API do Google (3.5), o inverso de
 * `mapGoogleEventToRow` — usado por `calendar_push` pra reenviar o estado
 * **atual** da linha local (não uma cópia velha de quando a chamada
 * original falhou), então uma edição feita antes do retry já sai com o
 * texto mais novo. Função pura, testada.
 */
export function mapRowToGoogleEventInput(row: EventRowForPush): GoogleEventInput {
  return {
    summary: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    start: toGoogleDateTime(row.starts_at, row.all_day, row.timezone),
    end: toGoogleDateTime(row.ends_at, row.all_day, row.timezone),
    attendeeEmails: extractAttendeeEmails(row.attendees),
  };
}
