import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../types";

vi.mock("@/lib/env", () => ({ serverEnv: { AI_MONTHLY_BUDGET_USD: undefined, STORAGE_PLAN_LIMIT_BYTES: undefined } }));

const countFailedJobsSince = vi.fn();
const getBackupStatus = vi.fn();
const hasRevokedGoogleConnection = vi.fn();
const getMonthlyAiSpendUsd = vi.fn();
const countMcpTokensExpiringSoon = vi.fn();
const countOldShareLinksWithoutExpiry = vi.fn();
const getTotalAttachmentsBytes = vi.fn();
vi.mock("@/features/ops/queries", () => ({
  countFailedJobsSince: (...args: unknown[]) => countFailedJobsSince(...args),
  getBackupStatus: (...args: unknown[]) => getBackupStatus(...args),
  hasRevokedGoogleConnection: (...args: unknown[]) => hasRevokedGoogleConnection(...args),
  getMonthlyAiSpendUsd: (...args: unknown[]) => getMonthlyAiSpendUsd(...args),
  countMcpTokensExpiringSoon: (...args: unknown[]) => countMcpTokensExpiringSoon(...args),
  countOldShareLinksWithoutExpiry: (...args: unknown[]) => countOldShareLinksWithoutExpiry(...args),
  getTotalAttachmentsBytes: (...args: unknown[]) => getTotalAttachmentsBytes(...args),
}));

const notifyOwner = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/messaging/notify-owner", () => ({ notifyOwner }));

const { opsDailyCheck } = await import("./ops-daily-check");

const OWNER_ID = "owner-1";

function job(): Job {
  return {
    id: "job-1",
    owner_id: OWNER_ID,
    kind: "ops_daily_check",
    payload: {},
    status: "running",
    priority: 100,
    attempts: 0,
    max_attempts: 5,
    run_after: new Date().toISOString(),
    locked_at: new Date().toISOString(),
    finished_at: null,
    last_error: null,
    result: null,
    dedupe_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as Job;
}

function mockAllHealthy() {
  countFailedJobsSince.mockResolvedValue(0);
  getBackupStatus.mockResolvedValue({ databaseStale: false });
  hasRevokedGoogleConnection.mockResolvedValue(false);
  getMonthlyAiSpendUsd.mockResolvedValue(0);
  countMcpTokensExpiringSoon.mockResolvedValue(0);
  countOldShareLinksWithoutExpiry.mockResolvedValue(0);
  getTotalAttachmentsBytes.mockResolvedValue(0);
}

beforeEach(() => {
  notifyOwner.mockClear();
});

describe("opsDailyCheck", () => {
  it("tudo saudável: done, sem problemas, sem notificar", async () => {
    mockAllHealthy();
    const outcome = await opsDailyCheck(job(), { supabase: {} as never });
    expect(outcome).toEqual({ status: "done", result: { problems: [] } });
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it("backup atrasado: notifica com o detalhe do problema", async () => {
    mockAllHealthy();
    getBackupStatus.mockResolvedValue({ databaseStale: true });

    const outcome = await opsDailyCheck(job(), { supabase: {} as never });
    expect(outcome).toMatchObject({ status: "done", result: { problems: ["backup"] } });
    expect(notifyOwner).toHaveBeenCalledTimes(1);
    expect(notifyOwner.mock.calls[0]![1].text).toContain("Backup de banco atrasado");
  });

  it("vários problemas: todos aparecem na notificação", async () => {
    mockAllHealthy();
    countFailedJobsSince.mockResolvedValue(2);
    hasRevokedGoogleConnection.mockResolvedValue(true);

    const outcome = await opsDailyCheck(job(), { supabase: {} as never });
    expect(outcome).toMatchObject({ status: "done", result: { problems: ["jobs_failing", "google_connection"] } });
    expect(notifyOwner).toHaveBeenCalledTimes(1);
    expect(notifyOwner.mock.calls[0]![1].title).toContain("2 ponto(s)");
  });

  it("sem AI_MONTHLY_BUDGET_USD/STORAGE_PLAN_LIMIT_BYTES configurados: esses dois checks nem entram na lista", async () => {
    mockAllHealthy();
    getMonthlyAiSpendUsd.mockResolvedValue(999_999);
    getTotalAttachmentsBytes.mockResolvedValue(999_999_999);

    const outcome = await opsDailyCheck(job(), { supabase: {} as never });
    expect(outcome).toEqual({ status: "done", result: { problems: [] } });
  });
});
