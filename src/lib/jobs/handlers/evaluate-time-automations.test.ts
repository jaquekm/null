import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../types";
import { FakeSupabase } from "@/lib/testing/fake-supabase";

const enqueueJob = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob }));

const notifyOwner = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/messaging/notify-owner", () => ({ notifyOwner }));

const { evaluateTimeAutomations } = await import("./evaluate-time-automations");

const OWNER_ID = "owner-1";

/** `JobOutcome` só tem `result` na variante "done" — helper estreita o tipo pros testes. */
function expectDone(outcome: Awaited<ReturnType<typeof evaluateTimeAutomations>>): Record<string, unknown> {
  if (outcome.status !== "done") throw new Error(`esperava "done", veio "${outcome.status}"`);
  return (outcome.result as Record<string, unknown>) ?? {};
}

function job(): Job {
  return {
    id: "job-1",
    owner_id: OWNER_ID,
    kind: "evaluate_time_automations",
    payload: {},
    status: "running",
    priority: 100,
    attempts: 0,
    max_attempts: 5,
    run_after: new Date().toISOString(),
    locked_at: null,
    finished_at: null,
    last_error: null,
    result: null,
    dedupe_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as Job;
}

beforeEach(() => {
  enqueueJob.mockClear();
  notifyOwner.mockClear();
});

describe("evaluateTimeAutomations — schedule", () => {
  it("nunca rodou (last_run_at nulo): dispara e grava last_run_at", async () => {
    const fake = new FakeSupabase();
    fake.seed("automations", [
      {
        id: "auto-1",
        owner_id: OWNER_ID,
        enabled: true,
        trigger: { type: "schedule", rrule: "FREQ=DAILY", timezone: "America/Sao_Paulo" },
        conditions: [],
        actions: [{ type: "notify_me", title: "Bom dia", body: "Revisão semanal" }],
        type_id: null,
        space_id: null,
        run_count: 0,
        last_run_at: null,
        created_at: "2020-01-01T00:00:00.000Z",
      },
    ]);

    const outcome = await evaluateTimeAutomations(job(), { supabase: fake as never });
    expect(outcome.status).toBe("done");
    expect(expectDone(outcome)).toMatchObject({ scheduleRuns: 1 });
    expect(notifyOwner).toHaveBeenCalledTimes(1);
    expect(fake.rowsOf("automations")[0]!.last_run_at).not.toBeNull();
    expect(fake.rowsOf("automation_runs")).toHaveLength(1);
  });

  it("já rodou hoje (last_run_at recente): não dispara de novo", async () => {
    const fake = new FakeSupabase();
    fake.seed("automations", [
      {
        id: "auto-1",
        owner_id: OWNER_ID,
        enabled: true,
        trigger: { type: "schedule", rrule: "FREQ=DAILY", timezone: "America/Sao_Paulo" },
        conditions: [],
        actions: [{ type: "notify_me", title: "x", body: "y" }],
        type_id: null,
        space_id: null,
        run_count: 3,
        last_run_at: new Date().toISOString(),
        created_at: "2020-01-01T00:00:00.000Z",
      },
    ]);

    const outcome = await evaluateTimeAutomations(job(), { supabase: fake as never });
    expect(expectDone(outcome)).toMatchObject({ scheduleRuns: 0 });
    expect(notifyOwner).not.toHaveBeenCalled();
  });
});

describe("evaluateTimeAutomations — date_reached", () => {
  function seedDateReachedAutomation(fake: FakeSupabase, overrides: Record<string, unknown> = {}) {
    fake.seed("automations", [
      {
        id: "auto-1",
        owner_id: OWNER_ID,
        enabled: true,
        trigger: { type: "date_reached", field: "vencimento", offsetMinutes: 0 },
        conditions: [],
        actions: [{ type: "notify_me", title: "Vence hoje", body: "x" }],
        type_id: "type-1",
        space_id: null,
        run_count: 0,
        last_run_at: null,
        ...overrides,
      },
    ]);
  }

  it("data já passou: dispara uma vez; rodar de novo não dispara outra", async () => {
    const fake = new FakeSupabase();
    seedDateReachedAutomation(fake);
    fake.seed("items", [
      { id: "item-1", owner_id: OWNER_ID, type_id: "type-1", space_id: null, title: "Conta", status: "active", properties: { vencimento: "2020-01-01" }, deleted_at: null },
    ]);

    const first = await evaluateTimeAutomations(job(), { supabase: fake as never });
    expect(expectDone(first)).toMatchObject({ dateReachedRuns: 1 });
    expect(notifyOwner).toHaveBeenCalledTimes(1);

    const second = await evaluateTimeAutomations(job(), { supabase: fake as never });
    expect(expectDone(second)).toMatchObject({ dateReachedRuns: 0 });
    expect(notifyOwner).toHaveBeenCalledTimes(1); // não disparou de novo
  });

  it("data no futuro: não dispara", async () => {
    const fake = new FakeSupabase();
    seedDateReachedAutomation(fake);
    fake.seed("items", [
      { id: "item-1", owner_id: OWNER_ID, type_id: "type-1", space_id: null, title: "Conta", status: "active", properties: { vencimento: "2099-01-01" }, deleted_at: null },
    ]);

    const outcome = await evaluateTimeAutomations(job(), { supabase: fake as never });
    expect(expectDone(outcome)).toMatchObject({ dateReachedRuns: 0 });
  });

  it("sem type_id na automação: não escaneia nada (não dá pra saber quais itens)", async () => {
    const fake = new FakeSupabase();
    seedDateReachedAutomation(fake, { type_id: null });
    fake.seed("items", [
      { id: "item-1", owner_id: OWNER_ID, type_id: "type-1", space_id: null, title: "Conta", status: "active", properties: { vencimento: "2020-01-01" }, deleted_at: null },
    ]);

    const outcome = await evaluateTimeAutomations(job(), { supabase: fake as never });
    expect(expectDone(outcome)).toMatchObject({ dateReachedRuns: 0 });
  });
});

describe("evaluateTimeAutomations — no_activity", () => {
  const LONG_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const RECENT = new Date().toISOString();

  function seedNoActivityAutomation(fake: FakeSupabase) {
    fake.seed("automations", [
      {
        id: "auto-1",
        owner_id: OWNER_ID,
        enabled: true,
        trigger: { type: "no_activity", days: 7 },
        conditions: [],
        actions: [{ type: "notify_me", title: "Parado", body: "x" }],
        type_id: "type-1",
        space_id: null,
        run_count: 0,
        last_run_at: null,
      },
    ]);
  }

  it("item sem atualização há mais dias que o limite: dispara uma vez", async () => {
    const fake = new FakeSupabase();
    seedNoActivityAutomation(fake);
    fake.seed("items", [
      { id: "item-1", owner_id: OWNER_ID, type_id: "type-1", space_id: null, title: "Oportunidade", status: "active", properties: {}, updated_at: LONG_AGO, deleted_at: null },
    ]);

    const first = await evaluateTimeAutomations(job(), { supabase: fake as never });
    expect(expectDone(first)).toMatchObject({ noActivityRuns: 1 });

    const second = await evaluateTimeAutomations(job(), { supabase: fake as never });
    expect(expectDone(second)).toMatchObject({ noActivityRuns: 0 });
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("item atualizado recentemente: não dispara", async () => {
    const fake = new FakeSupabase();
    seedNoActivityAutomation(fake);
    fake.seed("items", [
      { id: "item-1", owner_id: OWNER_ID, type_id: "type-1", space_id: null, title: "Oportunidade", status: "active", properties: {}, updated_at: RECENT, deleted_at: null },
    ]);

    const outcome = await evaluateTimeAutomations(job(), { supabase: fake as never });
    expect(expectDone(outcome)).toMatchObject({ noActivityRuns: 0 });
  });

  it("item parado, mas um item ligado foi atualizado recentemente: não dispara ('nem itens ligados')", async () => {
    const fake = new FakeSupabase();
    seedNoActivityAutomation(fake);
    fake.seed("items", [
      { id: "item-1", owner_id: OWNER_ID, type_id: "type-1", space_id: null, title: "Oportunidade", status: "active", properties: {}, updated_at: LONG_AGO, deleted_at: null },
      { id: "item-2", owner_id: OWNER_ID, type_id: "type-2", space_id: null, title: "Atividade", status: "active", properties: {}, updated_at: RECENT, deleted_at: null },
    ]);
    fake.seed("links", [{ id: "l1", source_id: "item-1", target_id: "item-2" }]);

    const outcome = await evaluateTimeAutomations(job(), { supabase: fake as never });
    expect(expectDone(outcome)).toMatchObject({ noActivityRuns: 0 });
  });
});
