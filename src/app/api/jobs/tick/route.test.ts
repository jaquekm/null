import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ serverEnv: { CRON_SECRET: "cron-secret" } }));

const runJobMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/jobs/run-job", () => ({ runJob: runJobMock }));

interface Config {
  schedules?: Record<string, unknown>[];
  jobsToClaim?: Record<string, unknown>[];
}

function fakeSupabase(config: Config) {
  const insertedJobs: Record<string, unknown>[] = [];
  const scheduleUpdates: Record<string, unknown>[] = [];
  let claimCalls = 0;

  const client = {
    from: (table: string) => {
      if (table === "job_schedules") {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: config.schedules ?? [], error: null }) }),
          update: (values: Record<string, unknown>) => {
            scheduleUpdates.push(values);
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      }
      if (table === "jobs") {
        return {
          insert: (values: Record<string, unknown>) => {
            insertedJobs.push(values);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
    rpc: (name: string) => {
      if (name !== "claim_jobs") throw new Error(`rpc inesperada: ${name}`);
      claimCalls++;
      return Promise.resolve({ data: claimCalls === 1 ? (config.jobsToClaim ?? []) : [], error: null });
    },
  };
  return { client, insertedJobs, scheduleUpdates };
}

let clientForTest: ReturnType<typeof fakeSupabase>["client"] | null = null;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => clientForTest }));

const { POST } = await import("./route");

function fakeRequest(authHeader?: string): Request {
  return new Request("https://hub.example/api/jobs/tick", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("POST /api/jobs/tick", () => {
  beforeEach(() => {
    runJobMock.mockClear();
    clientForTest = null;
  });

  it("sem Authorization: 401, não chega a criar o cliente admin nem rodar jobs", async () => {
    const res = await POST(fakeRequest());
    expect(res.status).toBe(401);
    expect(runJobMock).not.toHaveBeenCalled();
  });

  it("com segredo errado: 401", async () => {
    const res = await POST(fakeRequest("Bearer segredo-errado"));
    expect(res.status).toBe(401);
    expect(runJobMock).not.toHaveBeenCalled();
  });

  it("com segredo certo: enfileira agendamentos vencidos e roda os jobs reivindicados", async () => {
    const dueSchedule = { kind: "purge_trash", owner_id: "owner-1", payload: {}, interval_seconds: 3600, last_enqueued_at: null };
    const notDueSchedule = {
      kind: "aggregate_usage",
      owner_id: "owner-1",
      payload: {},
      interval_seconds: 3600,
      last_enqueued_at: new Date().toISOString(),
    };
    const claimedJob = { id: "job-1", kind: "purge_trash" };
    const { client, insertedJobs, scheduleUpdates } = fakeSupabase({
      schedules: [dueSchedule, notDueSchedule],
      jobsToClaim: [claimedJob],
    });
    clientForTest = client;

    const res = await POST(fakeRequest("Bearer cron-secret"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { processed: number; ids: string[] };
    expect(body).toEqual({ processed: 1, ids: ["job-1"] });

    expect(insertedJobs).toHaveLength(1);
    expect(insertedJobs[0]).toMatchObject({ kind: "purge_trash", dedupe_key: "schedule:purge_trash" });
    expect(scheduleUpdates).toHaveLength(1);

    expect(runJobMock).toHaveBeenCalledTimes(1);
    expect(runJobMock).toHaveBeenCalledWith(client, claimedJob);
  });
});
