import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fake-supabase";
import type { Job } from "../types";

const notifyOwnerMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/messaging/notify-owner", () => ({ notifyOwner: notifyOwnerMock }));

const { remindRestoreTest } = await import("./remind-restore-test");

const OWNER_ID = "owner-1";

function fakeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: OWNER_ID,
    kind: "remind_restore_test",
    payload: {},
    status: "running",
    priority: 100,
    attempts: 1,
    max_attempts: 5,
    run_after: "2026-09-24T00:00:00.000Z",
    locked_at: "2026-09-24T00:00:00.000Z",
    finished_at: null,
    last_error: null,
    result: null,
    dedupe_key: null,
    created_at: "2026-09-24T00:00:00.000Z",
    updated_at: "2026-09-24T00:00:00.000Z",
    ...overrides,
  };
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("remindRestoreTest", () => {
  beforeEach(() => {
    notifyOwnerMock.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("nenhum teste registrado ainda: avisa o dono", async () => {
    const fake = new FakeSupabase();
    const outcome = await remindRestoreTest(fakeJob(), { supabase: fake as never });
    expect(outcome).toEqual({ status: "done", result: { reminded: true, daysSinceLastRun: null } });
    expect(notifyOwnerMock).toHaveBeenCalledWith(OWNER_ID, expect.objectContaining({ title: "Teste de restauração do backup" }));
  });

  it("último teste há 10 dias: não incomoda", async () => {
    const fake = new FakeSupabase();
    fake.seed("backup_runs", [{ owner_id: OWNER_ID, kind: "restore_test", status: "success", created_at: daysAgoIso(10) }]);

    const outcome = await remindRestoreTest(fakeJob(), { supabase: fake as never });
    expect(outcome).toEqual({ status: "done", result: { skipped: "recent_test" } });
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("último teste há 40 dias: avisa de novo, com a contagem de dias na mensagem", async () => {
    const fake = new FakeSupabase();
    fake.seed("backup_runs", [{ owner_id: OWNER_ID, kind: "restore_test", status: "failed", created_at: daysAgoIso(40) }]);

    const outcome = await remindRestoreTest(fakeJob(), { supabase: fake as never });
    expect(outcome).toEqual({ status: "done", result: { reminded: true, daysSinceLastRun: 40 } });
    expect(notifyOwnerMock).toHaveBeenCalledWith(OWNER_ID, expect.objectContaining({ text: expect.stringContaining("40 dias") }));
  });

  it("ignora teste de restauração de outro dono", async () => {
    const fake = new FakeSupabase();
    fake.seed("backup_runs", [{ owner_id: "outro-dono", kind: "restore_test", status: "success", created_at: daysAgoIso(1) }]);

    const outcome = await remindRestoreTest(fakeJob({ owner_id: OWNER_ID }), { supabase: fake as never });
    expect(outcome).toMatchObject({ status: "done", result: { reminded: true } });
  });
});
