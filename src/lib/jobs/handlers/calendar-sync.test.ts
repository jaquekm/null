import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../types";

const listCalendarEventsMock = vi.fn();
class MockGoogleSyncTokenExpiredError extends Error {}
vi.mock("@/lib/google/calendar", () => ({
  listCalendarEvents: listCalendarEventsMock,
  GoogleSyncTokenExpiredError: MockGoogleSyncTokenExpiredError,
}));

const getAccessTokenMock = vi.fn();
class MockGoogleConnectionRevokedError extends Error {}
class MockGoogleConnectionNotFoundError extends Error {}
vi.mock("@/lib/google/client", () => ({
  getAccessToken: getAccessTokenMock,
  GoogleConnectionRevokedError: MockGoogleConnectionRevokedError,
  GoogleConnectionNotFoundError: MockGoogleConnectionNotFoundError,
}));

const { calendarSync } = await import("./calendar-sync");

function fakeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: "owner-1",
    kind: "calendar_sync",
    payload: {},
    status: "running",
    priority: 100,
    attempts: 1,
    max_attempts: 5,
    run_after: "2026-09-20T00:00:00.000Z",
    locked_at: "2026-09-20T00:00:00.000Z",
    finished_at: null,
    last_error: null,
    result: null,
    dedupe_key: null,
    created_at: "2026-09-20T00:00:00.000Z",
    updated_at: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

interface Config {
  calendars?: Record<string, unknown>[] | null;
  calendarsError?: unknown;
  connections?: Record<string, unknown>[] | null;
  contacts?: Record<string, unknown>[] | null;
  eventsUpsertResult?: { item_id: string | null; attendees: unknown }[];
  eventsUpsertError?: unknown;
}

function fakeSupabase(config: Config) {
  const calendarUpdates: Record<string, unknown>[] = [];
  const eventDeletes: Record<string, unknown>[] = [];
  const eventUpserts: Record<string, unknown>[][] = [];
  const itemContactUpserts: Record<string, unknown>[][] = [];

  const client = {
    from: (table: string) => {
      if (table === "calendars") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: config.calendars ?? [], error: config.calendarsError ?? null }),
            }),
          }),
          update: (values: Record<string, unknown>) => {
            calendarUpdates.push(values);
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      }
      if (table === "google_connections") {
        return { select: () => ({ eq: () => Promise.resolve({ data: config.connections ?? [], error: null }) }) };
      }
      if (table === "events") {
        return {
          upsert: (rows: Record<string, unknown>[]) => {
            eventUpserts.push(rows);
            return {
              select: () =>
                Promise.resolve({ data: config.eventsUpsertResult ?? [], error: config.eventsUpsertError ?? null }),
            };
          },
          delete: () => ({
            eq: (col: string, val: unknown) => {
              const filters: Record<string, unknown> = { [col]: val };
              return {
                eq: (col2: string, val2: unknown) => {
                  filters[col2] = val2;
                  return {
                    lt: (col3: string, val3: unknown) => {
                      filters[col3] = val3;
                      eventDeletes.push(filters);
                      return Promise.resolve({ error: null });
                    },
                  };
                },
              };
            },
          }),
        };
      }
      if (table === "contacts") {
        return { select: () => ({ eq: () => Promise.resolve({ data: config.contacts ?? [] }) }) };
      }
      if (table === "item_contacts") {
        return {
          upsert: (rows: Record<string, unknown>[]) => {
            itemContactUpserts.push(rows);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };

  return { client: client as never, calendarUpdates, eventDeletes, eventUpserts, itemContactUpserts };
}

const activeConnection = { id: "conn-1", status: "active" };
const calendar = { id: "cal-1", connection_id: "conn-1", external_id: "ext-cal-1", sync_token: null };

function googleEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "ev-1",
    etag: '"1"',
    status: "confirmed",
    summary: "Reunião",
    start: { dateTime: "2026-01-05T10:00:00-03:00" },
    end: { dateTime: "2026-01-05T11:00:00-03:00" },
    ...overrides,
  };
}

describe("calendarSync", () => {
  beforeEach(() => {
    listCalendarEventsMock.mockReset();
    getAccessTokenMock.mockReset();
    getAccessTokenMock.mockResolvedValue("access-token");
  });

  it("sem calendários com sync_enabled: done, nada é chamado", async () => {
    const { client } = fakeSupabase({ calendars: [] });
    const outcome = await calendarSync(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { calendarsSynced: 0 } });
    expect(getAccessTokenMock).not.toHaveBeenCalled();
  });

  it("erro ao listar calendários: retry", async () => {
    const { client } = fakeSupabase({ calendarsError: { message: "boom" } });
    const outcome = await calendarSync(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "retry" });
  });

  it("conexão revogada: pula o calendário sem chamar getAccessToken nem listar eventos", async () => {
    const { client } = fakeSupabase({ calendars: [calendar], connections: [{ id: "conn-1", status: "revoked" }] });
    const outcome = await calendarSync(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { calendarsSynced: 0, eventsUpserted: 0 } });
    expect(getAccessTokenMock).not.toHaveBeenCalled();
    expect(listCalendarEventsMock).not.toHaveBeenCalled();
  });

  it("sincronização completa (sem sync_token): usa timeMin, salva o nextSyncToken da última página", async () => {
    listCalendarEventsMock.mockResolvedValueOnce({
      events: [googleEvent()],
      nextPageToken: null,
      nextSyncToken: "sync-novo",
    });
    const { client, calendarUpdates, eventUpserts } = fakeSupabase({
      calendars: [calendar],
      connections: [activeConnection],
      eventsUpsertResult: [{ item_id: null, attendees: [] }],
    });

    const outcome = await calendarSync(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done", result: { calendarsSynced: 1, eventsUpserted: 1 } });
    expect(listCalendarEventsMock).toHaveBeenCalledWith(
      "access-token",
      "ext-cal-1",
      expect.objectContaining({ syncToken: undefined, pageToken: undefined, timeMin: expect.any(String) }),
    );
    expect(eventUpserts[0]?.[0]).toMatchObject({ owner_id: "owner-1", calendar_id: "cal-1", external_id: "ev-1" });
    expect(calendarUpdates[0]).toMatchObject({ sync_token: "sync-novo" });
  });

  it("sincronização incremental (com sync_token): não manda timeMin", async () => {
    listCalendarEventsMock.mockResolvedValueOnce({ events: [], nextPageToken: null, nextSyncToken: "sync-2" });
    const { client } = fakeSupabase({
      calendars: [{ ...calendar, sync_token: "sync-1" }],
      connections: [activeConnection],
    });

    await calendarSync(fakeJob(), { supabase: client });

    expect(listCalendarEventsMock).toHaveBeenCalledWith(
      "access-token",
      "ext-cal-1",
      expect.objectContaining({ syncToken: "sync-1", timeMin: undefined }),
    );
  });

  it("pagina até não ter mais nextPageToken", async () => {
    listCalendarEventsMock
      .mockResolvedValueOnce({ events: [googleEvent({ id: "ev-1" })], nextPageToken: "page-2", nextSyncToken: undefined })
      .mockResolvedValueOnce({ events: [googleEvent({ id: "ev-2" })], nextPageToken: null, nextSyncToken: "sync-final" });
    const { client, calendarUpdates, eventUpserts } = fakeSupabase({
      calendars: [calendar],
      connections: [activeConnection],
      eventsUpsertResult: [{ item_id: null, attendees: [] }],
    });

    await calendarSync(fakeJob(), { supabase: client });

    expect(listCalendarEventsMock).toHaveBeenCalledTimes(2);
    expect(eventUpserts[0]).toHaveLength(2);
    expect(calendarUpdates[0]).toMatchObject({ sync_token: "sync-final" });
  });

  it("410 (syncToken expirado): descarta o token e refaz como sincronização completa", async () => {
    listCalendarEventsMock
      .mockRejectedValueOnce(new MockGoogleSyncTokenExpiredError())
      .mockResolvedValueOnce({ events: [googleEvent()], nextPageToken: null, nextSyncToken: "sync-refeito" });
    const { client, calendarUpdates } = fakeSupabase({
      calendars: [{ ...calendar, sync_token: "sync-expirado" }],
      connections: [activeConnection],
      eventsUpsertResult: [{ item_id: null, attendees: [] }],
    });

    const outcome = await calendarSync(fakeJob(), { supabase: client });

    expect(outcome).toMatchObject({ status: "done" });
    expect(listCalendarEventsMock).toHaveBeenNthCalledWith(2, "access-token", "ext-cal-1", expect.objectContaining({ syncToken: undefined }));
    expect(calendarUpdates[0]).toMatchObject({ sync_token: "sync-refeito" });
  });

  it("getAccessToken lança GoogleConnectionRevokedError: pula o calendário sem falhar o job", async () => {
    getAccessTokenMock.mockRejectedValue(new MockGoogleConnectionRevokedError());
    const { client } = fakeSupabase({ calendars: [calendar], connections: [activeConnection] });
    const outcome = await calendarSync(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { calendarsSynced: 0, eventsUpserted: 0 } });
  });

  it("erro de rede ao listar eventos: retry, mas processa os outros calendários", async () => {
    listCalendarEventsMock
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ events: [], nextPageToken: null, nextSyncToken: "sync-2" });
    const { client } = fakeSupabase({
      calendars: [calendar, { ...calendar, id: "cal-2", external_id: "ext-cal-2" }],
      connections: [activeConnection],
    });

    const outcome = await calendarSync(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "retry", error: expect.stringContaining("timeout") });
  });

  it("eventos cancelled há mais de 30 dias: apaga (delete com o filtro certo)", async () => {
    listCalendarEventsMock.mockResolvedValueOnce({ events: [], nextPageToken: null, nextSyncToken: "s1" });
    const { client, eventDeletes } = fakeSupabase({ calendars: [calendar], connections: [activeConnection] });

    await calendarSync(fakeJob(), { supabase: client });

    expect(eventDeletes[0]).toMatchObject({ calendar_id: "cal-1", status: "cancelled" });
  });

  it("evento com item_id (nota de reunião): liga attendees a contatos por e-mail em item_contacts", async () => {
    listCalendarEventsMock.mockResolvedValueOnce({
      events: [googleEvent({ attendees: [{ email: "fulano@example.com" }] })],
      nextPageToken: null,
      nextSyncToken: "s1",
    });
    const { client, itemContactUpserts } = fakeSupabase({
      calendars: [calendar],
      connections: [activeConnection],
      contacts: [{ id: "contact-1", email: "fulano@example.com" }],
      eventsUpsertResult: [{ item_id: "item-1", attendees: [{ email: "fulano@example.com" }] }],
    });

    await calendarSync(fakeJob(), { supabase: client });

    expect(itemContactUpserts[0]).toEqual([
      { item_id: "item-1", contact_id: "contact-1", owner_id: "owner-1", role: "participant" },
    ]);
  });

  it("evento sem item_id: não toca item_contacts", async () => {
    listCalendarEventsMock.mockResolvedValueOnce({
      events: [googleEvent({ attendees: [{ email: "fulano@example.com" }] })],
      nextPageToken: null,
      nextSyncToken: "s1",
    });
    const { client, itemContactUpserts } = fakeSupabase({
      calendars: [calendar],
      connections: [activeConnection],
      eventsUpsertResult: [{ item_id: null, attendees: [{ email: "fulano@example.com" }] }],
    });

    await calendarSync(fakeJob(), { supabase: client });

    expect(itemContactUpserts).toHaveLength(0);
  });
});
