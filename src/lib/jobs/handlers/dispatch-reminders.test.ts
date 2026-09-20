import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../types";

const dispatchReminderOccurrenceMock = vi.fn();
vi.mock("@/features/reminders/lib/dispatch", () => ({ dispatchReminderOccurrence: dispatchReminderOccurrenceMock }));

const { dispatchReminders } = await import("./dispatch-reminders");

function fakeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: "owner-1",
    kind: "dispatch_reminders",
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

function fakeSupabase(reminders: Record<string, unknown>[] | null, error: unknown = null) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    from: (table: string) => {
      if (table !== "reminders") throw new Error(`tabela inesperada: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              lte: (col: string, val: unknown) => {
                calls.push({ [col]: val });
                return {
                  order: () => ({
                    limit: () => Promise.resolve({ data: reminders, error }),
                  }),
                };
              },
            }),
          }),
        }),
      };
    },
  };
  return { client: client as never, calls };
}

describe("dispatchReminders", () => {
  beforeEach(() => {
    dispatchReminderOccurrenceMock.mockReset();
  });

  it("erro ao buscar lembretes: retry", async () => {
    const { client } = fakeSupabase(null, { message: "boom" });
    const outcome = await dispatchReminders(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "retry" });
  });

  it("nenhum lembrete vencido: done, processed: 0", async () => {
    const { client } = fakeSupabase([]);
    const outcome = await dispatchReminders(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { processed: 0 } });
  });

  it("processa cada lembrete vencido e soma os resultados", async () => {
    dispatchReminderOccurrenceMock
      .mockResolvedValueOnce({ sent: 1, failed: 0, skipped: 0 })
      .mockResolvedValueOnce({ sent: 0, failed: 1, skipped: 1 });
    const { client } = fakeSupabase([{ id: "rem-1" }, { id: "rem-2" }]);
    const outcome = await dispatchReminders(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { processed: 2, sent: 1, failed: 1, skipped: 1 } });
    expect(dispatchReminderOccurrenceMock).toHaveBeenCalledTimes(2);
    expect(dispatchReminderOccurrenceMock).toHaveBeenCalledWith(expect.anything(), "owner-1", { id: "rem-1" });
  });

  it("um lembrete falha ao processar: retry, mas continua os outros", async () => {
    dispatchReminderOccurrenceMock
      .mockRejectedValueOnce(new Error("falha ao enviar"))
      .mockResolvedValueOnce({ sent: 1, failed: 0, skipped: 0 });
    const { client } = fakeSupabase([{ id: "rem-1" }, { id: "rem-2" }]);
    const outcome = await dispatchReminders(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "retry" });
    expect(dispatchReminderOccurrenceMock).toHaveBeenCalledTimes(2);
  });
});
