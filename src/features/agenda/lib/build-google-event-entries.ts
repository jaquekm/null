import { DEFAULT_EVENT_COLOR, type AgendaEntry } from "./agenda-entry";

export interface GoogleEventRowForAgenda {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  status: string;
  calendar_id: string | null;
}

/** Eventos do Google → `AgendaEntry` (3.6). `cancelled` fica fora — a 3.5 já os mantém só por 30 dias pra histórico, não pra mostrar na agenda. */
export function buildGoogleEventEntries(
  events: GoogleEventRowForAgenda[],
  calendarColorById: Map<string, string | null>,
): AgendaEntry[] {
  return events
    .filter((event) => event.status !== "cancelled")
    .map((event) => ({
      id: `event:${event.id}`,
      title: event.title,
      start: event.starts_at,
      end: event.ends_at,
      allDay: event.all_day,
      color: (event.calendar_id && calendarColorById.get(event.calendar_id)) || DEFAULT_EVENT_COLOR,
      editable: true,
      kind: "google-event" as const,
      href: null,
    }));
}
