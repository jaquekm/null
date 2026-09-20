import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../types";

const insertGoogleEventMock = vi.fn();
const patchGoogleEventMock = vi.fn();
const deleteGoogleEventMock = vi.fn();
class MockGoogleEventConflictError extends Error {}
class MockGoogleEventNotFoundError extends Error {}
vi.mock("@/lib/google/calendar", () => ({
  insertGoogleEvent: insertGoogleEventMock,
  patchGoogleEvent: patchGoogleEventMock,
  deleteGoogleEvent: deleteGoogleEventMock,
  GoogleEventConflictError: MockGoogleEventConflictError,
  GoogleEventNotFoundError: MockGoogleEventNotFoundError,
}));

const getAccessTokenMock = vi.fn();
class MockGoogleConnectionRevokedError extends Error {}
class MockGoogleConnectionNotFoundError extends Error {}
vi.mock("@/lib/google/client", () => ({
  getAccessToken: getAccessTokenMock,
  GoogleConnectionRevokedError: MockGoogleConnectionRevokedError,
  GoogleConnectionNotFoundError: MockGoogleConnectionNotFoundError,
}));

const { calendarPush } = await import("./calendar-push");

function fakeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: "owner-1",
    kind: "calendar_push",
    payload: { eventId: "11111111-1111-4111-8111-111111111111", operation: "update" },
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

const eventRow = {
  id: "11111111-1111-4111-8111-111111111111",
  calendar_id: "cal-1",
  external_id: "ext-ev-1",
  remote_etag: '"1"',
  title: "Reunião",
  description: null,
  location: null,
  starts_at: "2026-01-05T13:00:00.000Z",
  ends_at: "2026-01-05T14:00:00.000Z",
  all_day: false,
  timezone: "America/Sao_Paulo",
  attendees: [],
};
const calendarRow = { connection_id: "conn-1", external_id: "ext-cal-1" };

function fakeSupabase(config: { event?: Record<string, unknown> | null; calendar?: Record<string, unknown> | null }) {
  const eventUpdates: Record<string, unknown>[] = [];
  const eventDeletes: string[] = [];

  const client = {
    from: (table: string) => {
      if (table === "events") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: config.event ?? null, error: null }) }) }),
          update: (values: Record<string, unknown>) => {
            eventUpdates.push(values);
            return { eq: () => Promise.resolve({ error: null }) };
          },
          delete: () => ({
            eq: (_col: string, id: string) => {
              eventDeletes.push(id);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === "calendars") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: config.calendar ?? null, error: null }) }) }),
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };

  return { client: client as never, eventUpdates, eventDeletes };
}

describe("calendarPush", () => {
  beforeEach(() => {
    insertGoogleEventMock.mockReset();
    patchGoogleEventMock.mockReset();
    deleteGoogleEventMock.mockReset();
    getAccessTokenMock.mockReset();
    getAccessTokenMock.mockResolvedValue("access-token");
  });

  it("payload inválido: failed", async () => {
    const outcome = await calendarPush(fakeJob({ payload: {} }), { supabase: fakeSupabase({}).client });
    expect(outcome).toMatchObject({ status: "failed" });
  });

  it("evento já não existe localmente: done (nada a empurrar)", async () => {
    const { client } = fakeSupabase({ event: null });
    const outcome = await calendarPush(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done" });
  });

  it("calendário do evento não encontrado: failed", async () => {
    const { client } = fakeSupabase({ event: eventRow, calendar: null });
    const outcome = await calendarPush(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "failed" });
  });

  it("conexão revogada: failed (não insiste)", async () => {
    getAccessTokenMock.mockRejectedValue(new MockGoogleConnectionRevokedError());
    const { client } = fakeSupabase({ event: eventRow, calendar: calendarRow });
    const outcome = await calendarPush(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "failed" });
  });

  describe("operation: delete", () => {
    it("sem external_id (nunca existiu no Google): done sem chamar a API", async () => {
      const { client } = fakeSupabase({ event: { ...eventRow, external_id: null }, calendar: calendarRow });
      const outcome = await calendarPush(fakeJob({ payload: { eventId: eventRow.id, operation: "delete" } }), {
        supabase: client,
      });
      expect(outcome).toEqual({ status: "done" });
      expect(deleteGoogleEventMock).not.toHaveBeenCalled();
    });

    it("sucesso: apaga a linha local, done", async () => {
      deleteGoogleEventMock.mockResolvedValue(undefined);
      const { client, eventDeletes } = fakeSupabase({ event: eventRow, calendar: calendarRow });
      const outcome = await calendarPush(fakeJob({ payload: { eventId: eventRow.id, operation: "delete" } }), {
        supabase: client,
      });
      expect(outcome).toEqual({ status: "done" });
      expect(eventDeletes).toEqual([eventRow.id]);
    });

    it("já não existe no Google (404/410): trata como sucesso, apaga local", async () => {
      deleteGoogleEventMock.mockRejectedValue(new MockGoogleEventNotFoundError());
      const { client, eventDeletes } = fakeSupabase({ event: eventRow, calendar: calendarRow });
      const outcome = await calendarPush(fakeJob({ payload: { eventId: eventRow.id, operation: "delete" } }), {
        supabase: client,
      });
      expect(outcome).toEqual({ status: "done" });
      expect(eventDeletes).toEqual([eventRow.id]);
    });

    it("erro de rede: retry, não apaga a linha local", async () => {
      deleteGoogleEventMock.mockRejectedValue(new Error("timeout"));
      const { client, eventDeletes } = fakeSupabase({ event: eventRow, calendar: calendarRow });
      const outcome = await calendarPush(fakeJob({ payload: { eventId: eventRow.id, operation: "delete" } }), {
        supabase: client,
      });
      expect(outcome).toMatchObject({ status: "retry" });
      expect(eventDeletes).toEqual([]);
    });
  });

  describe("operation: create/update", () => {
    it("create: chama insertGoogleEvent e salva external_id/etag, local_dirty=false", async () => {
      insertGoogleEventMock.mockResolvedValue({
        id: "ext-novo",
        etag: '"2"',
        status: "confirmed",
        start: { dateTime: eventRow.starts_at },
        end: { dateTime: eventRow.ends_at },
      });
      const { client, eventUpdates } = fakeSupabase({ event: { ...eventRow, external_id: null }, calendar: calendarRow });

      const outcome = await calendarPush(fakeJob({ payload: { eventId: eventRow.id, operation: "create" } }), {
        supabase: client,
      });

      expect(outcome).toEqual({ status: "done" });
      expect(insertGoogleEventMock).toHaveBeenCalled();
      expect(eventUpdates[0]).toMatchObject({ external_id: "ext-novo", local_dirty: false });
    });

    it("update com external_id existente: chama patchGoogleEvent com o etag salvo", async () => {
      patchGoogleEventMock.mockResolvedValue({
        id: "ext-ev-1",
        etag: '"2"',
        status: "confirmed",
        start: { dateTime: eventRow.starts_at },
        end: { dateTime: eventRow.ends_at },
      });
      const { client, eventUpdates } = fakeSupabase({ event: eventRow, calendar: calendarRow });

      const outcome = await calendarPush(fakeJob(), { supabase: client });

      expect(outcome).toEqual({ status: "done" });
      expect(patchGoogleEventMock).toHaveBeenCalledWith("access-token", "ext-cal-1", "ext-ev-1", expect.anything(), '"1"');
      expect(eventUpdates[0]).toMatchObject({ local_dirty: false });
    });

    it("update mas a criação original nunca chegou a acontecer (sem external_id): cria em vez de fazer patch", async () => {
      insertGoogleEventMock.mockResolvedValue({
        id: "ext-novo",
        etag: '"1"',
        status: "confirmed",
        start: { dateTime: eventRow.starts_at },
        end: { dateTime: eventRow.ends_at },
      });
      const { client } = fakeSupabase({ event: { ...eventRow, external_id: null }, calendar: calendarRow });

      await calendarPush(fakeJob(), { supabase: client });

      expect(insertGoogleEventMock).toHaveBeenCalled();
      expect(patchGoogleEventMock).not.toHaveBeenCalled();
    });

    it("conflito (412): o Google venceu, só limpa local_dirty (a próxima sincronização traz a versão certa)", async () => {
      patchGoogleEventMock.mockRejectedValue(new MockGoogleEventConflictError());
      const { client, eventUpdates } = fakeSupabase({ event: eventRow, calendar: calendarRow });

      const outcome = await calendarPush(fakeJob(), { supabase: client });

      expect(outcome).toEqual({ status: "done" });
      expect(eventUpdates).toEqual([{ local_dirty: false }]);
    });

    it("evento excluído no Google (404): marca cancelled localmente", async () => {
      patchGoogleEventMock.mockRejectedValue(new MockGoogleEventNotFoundError());
      const { client, eventUpdates } = fakeSupabase({ event: eventRow, calendar: calendarRow });

      const outcome = await calendarPush(fakeJob(), { supabase: client });

      expect(outcome).toEqual({ status: "done" });
      expect(eventUpdates).toEqual([{ status: "cancelled", local_dirty: false }]);
    });

    it("erro de rede: retry", async () => {
      patchGoogleEventMock.mockRejectedValue(new Error("timeout"));
      const { client } = fakeSupabase({ event: eventRow, calendar: calendarRow });

      const outcome = await calendarPush(fakeJob(), { supabase: client });

      expect(outcome).toMatchObject({ status: "retry" });
    });
  });
});
