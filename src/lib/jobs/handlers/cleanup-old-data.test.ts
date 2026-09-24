import { describe, expect, it } from "vitest";
import { FakeSupabase } from "@/lib/testing/fake-supabase";
import type { Job } from "../types";
import { cleanupOldData } from "./cleanup-old-data";

const OWNER_ID = "owner-1";
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function job(): Job {
  return {
    id: "job-1",
    owner_id: OWNER_ID,
    kind: "cleanup_old_data",
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

describe("cleanupOldData", () => {
  it("nada pra limpar: done, tudo zero", async () => {
    const fake = new FakeSupabase();
    const outcome = await cleanupOldData(job(), { supabase: fake as never });
    expect(outcome).toEqual({
      status: "done",
      result: { jobs: 0, shareLinkViews: 0, automationEventLog: 0, cancelledEvents: 0, exports: 0 },
    });
  });

  it("apaga só o que passou do prazo de cada tabela, mantém o resto", async () => {
    const fake = new FakeSupabase();
    fake.seed("jobs", [
      { id: "j-old", owner_id: OWNER_ID, status: "done", finished_at: daysAgo(31) },
      { id: "j-recent", owner_id: OWNER_ID, status: "done", finished_at: daysAgo(1) },
      { id: "j-running", owner_id: OWNER_ID, status: "running", finished_at: null },
    ]);
    fake.seed("share_link_views", [
      { id: "v-old", owner_id: OWNER_ID, created_at: daysAgo(181) },
      { id: "v-recent", owner_id: OWNER_ID, created_at: daysAgo(1) },
    ]);
    fake.seed("automation_event_log", [
      { id: "l-old", owner_id: OWNER_ID, created_at: daysAgo(8) },
      { id: "l-recent", owner_id: OWNER_ID, created_at: daysAgo(1) },
    ]);
    fake.seed("events", [
      { id: "e-old-cancelled", owner_id: OWNER_ID, status: "cancelled", updated_at: daysAgo(31) },
      { id: "e-recent-cancelled", owner_id: OWNER_ID, status: "cancelled", updated_at: daysAgo(1) },
      { id: "e-old-confirmed", owner_id: OWNER_ID, status: "confirmed", updated_at: daysAgo(31) },
    ]);
    fake.seed("backup_runs", [
      { id: "b-old-export", owner_id: OWNER_ID, kind: "export", created_at: daysAgo(8) },
      { id: "b-recent-export", owner_id: OWNER_ID, kind: "export", created_at: daysAgo(1) },
      { id: "b-old-database", owner_id: OWNER_ID, kind: "database", created_at: daysAgo(8) },
    ]);

    const outcome = await cleanupOldData(job(), { supabase: fake as never });
    expect(outcome).toEqual({
      status: "done",
      result: { jobs: 1, shareLinkViews: 1, automationEventLog: 1, cancelledEvents: 1, exports: 1 },
    });

    expect(fake.rowsOf("jobs").map((r) => r.id)).toEqual(["j-recent", "j-running"]);
    expect(fake.rowsOf("share_link_views").map((r) => r.id)).toEqual(["v-recent"]);
    expect(fake.rowsOf("automation_event_log").map((r) => r.id)).toEqual(["l-recent"]);
    expect(fake.rowsOf("events").map((r) => r.id)).toEqual(["e-recent-cancelled", "e-old-confirmed"]);
    expect(fake.rowsOf("backup_runs").map((r) => r.id)).toEqual(["b-recent-export", "b-old-database"]);
  });
});
