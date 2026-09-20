import "server-only";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  backgroundColor: string | null;
  timeZone: string | null;
  primary: boolean;
}

interface GoogleCalendarListResponse {
  items?: {
    id: string;
    summary?: string;
    backgroundColor?: string;
    timeZone?: string;
    primary?: boolean;
  }[];
}

/** `GET .../users/me/calendarList` (3.4) — calendários do usuário conectado, pra gravar em `calendars` no callback. */
export async function listGoogleCalendars(accessToken: string): Promise<GoogleCalendarListEntry[]> {
  const res = await fetch(`${CALENDAR_API_BASE}/users/me/calendarList`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Não foi possível listar os calendários do Google (HTTP ${res.status}).`);

  const data = (await res.json()) as GoogleCalendarListResponse;
  return (data.items ?? []).map((item) => ({
    id: item.id,
    summary: item.summary ?? item.id,
    backgroundColor: item.backgroundColor ?? null,
    timeZone: item.timeZone ?? null,
    primary: item.primary ?? false,
  }));
}
