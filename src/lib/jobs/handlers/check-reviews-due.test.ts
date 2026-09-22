import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fake-supabase";
import type { Job } from "../types";

const notifyOwnerMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/messaging/notify-owner", () => ({ notifyOwner: notifyOwnerMock }));

const getUserTimezoneMock = vi.fn().mockResolvedValue("America/Sao_Paulo");
vi.mock("@/features/reminders/queries", () => ({ getUserTimezone: getUserTimezoneMock }));

const getStudyTypeIdsMock = vi.fn();
const getStudySettingsMock = vi.fn();
const getReviewCountersMock = vi.fn();
vi.mock("@/features/study/queries", () => ({
  getStudyTypeIds: (...args: unknown[]) => getStudyTypeIdsMock(...args),
  getStudySettings: (...args: unknown[]) => getStudySettingsMock(...args),
  getReviewCounters: (...args: unknown[]) => getReviewCountersMock(...args),
}));

const { checkReviewsDue } = await import("./check-reviews-due");

const OWNER_ID = "owner-1";

function fakeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: OWNER_ID,
    kind: "check_reviews_due",
    payload: {},
    status: "running",
    priority: 100,
    attempts: 1,
    max_attempts: 5,
    run_after: "2026-09-22T11:00:00.000Z",
    locked_at: "2026-09-22T11:00:00.000Z",
    finished_at: null,
    last_error: null,
    result: null,
    dedupe_key: null,
    created_at: "2026-09-22T11:00:00.000Z",
    updated_at: "2026-09-22T11:00:00.000Z",
    ...overrides,
  };
}

describe("checkReviewsDue", () => {
  beforeEach(() => {
    getStudyTypeIdsMock.mockReset().mockResolvedValue({ flashcardTypeId: "type-flashcard" });
    getStudySettingsMock.mockReset().mockResolvedValue({ dailyNewCardLimit: 20, reviewPushHour: 8 });
    getReviewCountersMock.mockReset().mockResolvedValue({ new: 2, learning: 0, review: 3 });
    getUserTimezoneMock.mockClear().mockResolvedValue("America/Sao_Paulo");
    notifyOwnerMock.mockClear();
    // 11:00 UTC = 08:00 em America/Sao_Paulo (UTC-3).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T11:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pack não instalado: done, sem checar nada mais", async () => {
    getStudyTypeIdsMock.mockResolvedValue(null);
    const fake = new FakeSupabase();
    const outcome = await checkReviewsDue(fakeJob(), { supabase: fake as never });
    expect(outcome).toEqual({ status: "done", result: { skipped: "pack_not_installed" } });
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("fora da hora configurada: done, sem notificar", async () => {
    getStudySettingsMock.mockResolvedValue({ dailyNewCardLimit: 20, reviewPushHour: 20 });
    const fake = new FakeSupabase();
    const outcome = await checkReviewsDue(fakeJob(), { supabase: fake as never });
    expect(outcome).toEqual({ status: "done", result: { skipped: "not_the_configured_hour" } });
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("na hora certa, com cards pendentes: notifica e carimba a data", async () => {
    const fake = new FakeSupabase();
    fake.seed("user_settings", [{ owner_id: OWNER_ID, preferences: {} }]);

    const outcome = await checkReviewsDue(fakeJob(), { supabase: fake as never });
    expect(outcome).toEqual({ status: "done", result: { pending: 5, notified: true } });
    expect(notifyOwnerMock).toHaveBeenCalledWith(OWNER_ID, expect.objectContaining({ text: "Você tem 5 cards pra revisar." }));

    const settings = fake.rowsOf("user_settings")[0]!;
    expect((settings.preferences as Record<string, unknown>).study).toMatchObject({ lastReviewPushDate: "2026-09-22" });
  });

  it("na hora certa, sem cards pendentes: não notifica, mas ainda carimba a data", async () => {
    getReviewCountersMock.mockResolvedValue({ new: 0, learning: 0, review: 0 });
    const fake = new FakeSupabase();
    fake.seed("user_settings", [{ owner_id: OWNER_ID, preferences: {} }]);

    const outcome = await checkReviewsDue(fakeJob(), { supabase: fake as never });
    expect(outcome).toEqual({ status: "done", result: { pending: 0, notified: false } });
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("já notificou hoje: não notifica de novo", async () => {
    const fake = new FakeSupabase();
    fake.seed("user_settings", [{ owner_id: OWNER_ID, preferences: { study: { lastReviewPushDate: "2026-09-22" } } }]);

    const outcome = await checkReviewsDue(fakeJob(), { supabase: fake as never });
    expect(outcome).toEqual({ status: "done", result: { skipped: "already_sent_today" } });
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("preserva outras chaves de preferences ao carimbar a data", async () => {
    const fake = new FakeSupabase();
    fake.seed("user_settings", [{ owner_id: OWNER_ID, preferences: { autoOcr: false, study: { dailyNewCardLimit: 30 } } }]);

    await checkReviewsDue(fakeJob(), { supabase: fake as never });

    const preferences = fake.rowsOf("user_settings")[0]!.preferences as Record<string, unknown>;
    expect(preferences.autoOcr).toBe(false);
    expect(preferences.study).toMatchObject({ dailyNewCardLimit: 30, lastReviewPushDate: "2026-09-22" });
  });
});
