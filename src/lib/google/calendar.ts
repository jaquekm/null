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

/** `syncToken` expirado (410 Gone, 3.5) — quem chama deve apagar o token salvo e refazer a sincronização completa. */
export class GoogleSyncTokenExpiredError extends Error {
  constructor() {
    super("O syncToken do calendário expirou — é preciso refazer a sincronização completa.");
    this.name = "GoogleSyncTokenExpiredError";
  }
}

/** O evento não existe mais no Google (404) — tratado como sucesso por quem chama `deleteGoogleEvent`. */
export class GoogleEventNotFoundError extends Error {
  constructor() {
    super("Evento não encontrado no Google.");
    this.name = "GoogleEventNotFoundError";
  }
}

/** `etag` remoto mudou desde a última leitura (412, 3.5) — o Google vence o conflito, quem chama recarrega o evento. */
export class GoogleEventConflictError extends Error {
  constructor() {
    super("O evento foi alterado no Google Calendar desde a última sincronização.");
    this.name = "GoogleEventConflictError";
  }
}

export interface GoogleEventDateTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

export interface GoogleEventAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  etag: string;
  status: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  recurringEventId?: string;
  updated?: string;
  attendees?: GoogleEventAttendee[];
  hangoutLink?: string;
}

interface GoogleEventsListResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export interface ListCalendarEventsPage {
  events: GoogleCalendarEvent[];
  nextPageToken: string | null;
  /** Só vem preenchido na última página — é o token pra guardar em `calendars.sync_token`. */
  nextSyncToken: string | null;
}

/**
 * `GET .../calendars/{id}/events` (3.5). Duas formas, nunca misturadas:
 * `syncToken` (incremental) — não pode ir junto de `timeMin`/`timeMax`/`q`/etc,
 * exigência da API; ou `timeMin` (sincronização completa). `singleEvents` tem
 * que ser **igual** em toda sincronização incremental à da sincronização
 * completa que gerou o `syncToken` original, senão a API responde 400 — por
 * isso é sempre `true` aqui, nos dois casos (decisão registrada em
 * `docs/decisoes.md`). 410 vira `GoogleSyncTokenExpiredError`.
 */
export async function listCalendarEvents(
  accessToken: string,
  externalCalendarId: string,
  params: { syncToken?: string; pageToken?: string; timeMin?: string },
): Promise<ListCalendarEventsPage> {
  const query = new URLSearchParams({ singleEvents: "true", maxResults: "250" });
  if (params.syncToken) {
    query.set("syncToken", params.syncToken);
  } else if (params.timeMin) {
    query.set("timeMin", params.timeMin);
    query.set("orderBy", "startTime");
  }
  if (params.pageToken) query.set("pageToken", params.pageToken);

  const res = await fetch(`${CALENDAR_API_BASE}/calendars/${encodeURIComponent(externalCalendarId)}/events?${query}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 410) throw new GoogleSyncTokenExpiredError();
  if (!res.ok) throw new Error(`Não foi possível listar os eventos do calendário (HTTP ${res.status}).`);

  const data = (await res.json()) as GoogleEventsListResponse;
  return {
    events: data.items ?? [],
    nextPageToken: data.nextPageToken ?? null,
    nextSyncToken: data.nextSyncToken ?? null,
  };
}

export interface GoogleEventInput {
  summary: string;
  description?: string | null;
  location?: string | null;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
  attendeeEmails?: string[];
  /** Pede uma sala do Google Meet nova (`conferenceDataVersion=1`, 3.5). */
  addMeet?: boolean;
}

function buildEventBody(input: GoogleEventInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description ?? undefined,
    location: input.location ?? undefined,
    start: input.start,
    end: input.end,
  };
  if (input.attendeeEmails && input.attendeeEmails.length > 0) {
    body.attendees = input.attendeeEmails.map((email) => ({ email }));
  }
  if (input.addMeet) {
    body.conferenceData = {
      createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } },
    };
  }
  return body;
}

/** `POST .../events` (3.5, escrita app → Google). `conferenceDataVersion=1` é obrigatório pra o Meet ser criado de verdade. */
export async function insertGoogleEvent(
  accessToken: string,
  externalCalendarId: string,
  input: GoogleEventInput,
): Promise<GoogleCalendarEvent> {
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(externalCalendarId)}/events?conferenceDataVersion=1`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(buildEventBody(input)),
    },
  );
  if (!res.ok) throw new Error(`Não foi possível criar o evento no Google (HTTP ${res.status}).`);
  return (await res.json()) as GoogleCalendarEvent;
}

/**
 * `PATCH .../events/{id}` (3.5). `ifMatchEtag`, quando informado, faz o
 * Google recusar com 412 se o evento mudou remotamente desde a última
 * leitura — vira `GoogleEventConflictError`, e o Google vence o conflito
 * (quem chama recarrega o evento em vez de tentar de novo com os dados
 * locais).
 */
export async function patchGoogleEvent(
  accessToken: string,
  externalCalendarId: string,
  externalEventId: string,
  input: GoogleEventInput,
  ifMatchEtag?: string,
): Promise<GoogleCalendarEvent> {
  const headers: Record<string, string> = { authorization: `Bearer ${accessToken}`, "content-type": "application/json" };
  if (ifMatchEtag) headers["if-match"] = ifMatchEtag;

  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(externalCalendarId)}/events/${encodeURIComponent(externalEventId)}?conferenceDataVersion=1`,
    { method: "PATCH", headers, body: JSON.stringify(buildEventBody(input)) },
  );

  if (res.status === 412) throw new GoogleEventConflictError();
  if (res.status === 404) throw new GoogleEventNotFoundError();
  if (!res.ok) throw new Error(`Não foi possível atualizar o evento no Google (HTTP ${res.status}).`);
  return (await res.json()) as GoogleCalendarEvent;
}

/** `DELETE .../events/{id}` (3.5). 404/410 (já não existe no Google) viram `GoogleEventNotFoundError`, tratado como sucesso por quem chama. */
export async function deleteGoogleEvent(accessToken: string, externalCalendarId: string, externalEventId: string): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(externalCalendarId)}/events/${encodeURIComponent(externalEventId)}`,
    { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (res.status === 404 || res.status === 410) throw new GoogleEventNotFoundError();
  if (!res.ok && res.status !== 204) throw new Error(`Não foi possível excluir o evento no Google (HTTP ${res.status}).`);
}
