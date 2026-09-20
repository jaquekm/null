import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../types";

const getMeetingNotesSettingsMock = vi.fn();
vi.mock("@/features/settings/queries", () => ({ getMeetingNotesSettings: getMeetingNotesSettingsMock }));

const createMeetingNoteForEventMock = vi.fn();
vi.mock("@/features/meeting-notes/lib/create-meeting-note", () => ({ createMeetingNoteForEvent: createMeetingNoteForEventMock }));

const { prepareMeetingNotes } = await import("./prepare-meeting-notes");

function fakeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: "owner-1",
    kind: "prepare_meeting_notes",
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

function fakeSupabase(events: Record<string, unknown>[] | null, error: unknown = null) {
  const client = {
    from: (table: string) => {
      if (table !== "events") throw new Error(`tabela inesperada: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              neq: () => ({
                gte: () => ({
                  lte: () => Promise.resolve({ data: events, error }),
                }),
              }),
            }),
          }),
        }),
      };
    },
  };
  return client as never;
}

describe("prepareMeetingNotes", () => {
  beforeEach(() => {
    getMeetingNotesSettingsMock.mockReset();
    createMeetingNoteForEventMock.mockReset();
  });

  it("configuração desligada: done, não consulta eventos", async () => {
    getMeetingNotesSettingsMock.mockResolvedValue({ enabled: false, minutesBefore: 15 });
    const outcome = await prepareMeetingNotes(fakeJob(), { supabase: fakeSupabase(null) });
    expect(outcome).toEqual({ status: "done" });
    expect(createMeetingNoteForEventMock).not.toHaveBeenCalled();
  });

  it("sem eventos na janela: done, created: 0", async () => {
    getMeetingNotesSettingsMock.mockResolvedValue({ enabled: true, minutesBefore: 15 });
    const outcome = await prepareMeetingNotes(fakeJob(), { supabase: fakeSupabase([]) });
    expect(outcome).toEqual({ status: "done", result: { created: 0 } });
  });

  it("erro ao buscar eventos: retry", async () => {
    getMeetingNotesSettingsMock.mockResolvedValue({ enabled: true, minutesBefore: 15 });
    const outcome = await prepareMeetingNotes(fakeJob(), { supabase: fakeSupabase(null, { message: "boom" }) });
    expect(outcome).toMatchObject({ status: "retry" });
  });

  it("evento sem convidados: pula, não cria nota", async () => {
    getMeetingNotesSettingsMock.mockResolvedValue({ enabled: true, minutesBefore: 15 });
    const outcome = await prepareMeetingNotes(fakeJob(), { supabase: fakeSupabase([{ id: "ev-1", attendees: [] }]) });
    expect(outcome).toEqual({ status: "done", result: { created: 0 } });
    expect(createMeetingNoteForEventMock).not.toHaveBeenCalled();
  });

  it("evento com convidados: cria a nota", async () => {
    getMeetingNotesSettingsMock.mockResolvedValue({ enabled: true, minutesBefore: 15 });
    createMeetingNoteForEventMock.mockResolvedValue({ ok: true, data: { itemId: "item-1", alreadyExisted: false } });
    const outcome = await prepareMeetingNotes(fakeJob(), {
      supabase: fakeSupabase([{ id: "ev-1", attendees: [{ email: "a@example.com" }] }]),
    });
    expect(outcome).toEqual({ status: "done", result: { created: 1 } });
    expect(createMeetingNoteForEventMock).toHaveBeenCalledWith(expect.anything(), "owner-1", "ev-1");
  });

  it("falha ao criar uma nota: retry, mas continua processando as outras", async () => {
    getMeetingNotesSettingsMock.mockResolvedValue({ enabled: true, minutesBefore: 15 });
    createMeetingNoteForEventMock
      .mockResolvedValueOnce({ ok: false, error: "sem tipo Reunião" })
      .mockResolvedValueOnce({ ok: true, data: { itemId: "item-2", alreadyExisted: false } });
    const outcome = await prepareMeetingNotes(fakeJob(), {
      supabase: fakeSupabase([
        { id: "ev-1", attendees: [{ email: "a@example.com" }] },
        { id: "ev-2", attendees: [{ email: "b@example.com" }] },
      ]),
    });
    expect(outcome).toMatchObject({ status: "retry" });
    expect(createMeetingNoteForEventMock).toHaveBeenCalledTimes(2);
  });
});
