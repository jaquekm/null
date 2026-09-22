import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../types";
import { FakeSupabase } from "@/lib/testing/fake-supabase";

const enqueueJob = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob }));

const notifyOwner = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/messaging/notify-owner", () => ({ notifyOwner }));

const { runAutomations } = await import("./run-automations");

const OWNER_ID = "owner-1";

function job(payload: Record<string, unknown>): Job {
  return {
    id: "job-1",
    owner_id: OWNER_ID,
    kind: "run_automations",
    payload,
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

function seedAutomation(fake: FakeSupabase, overrides: Record<string, unknown> = {}) {
  fake.seed("automations", [
    {
      id: "auto-1",
      owner_id: OWNER_ID,
      name: "Mover pra ganho",
      enabled: true,
      trigger: { type: "property_changed", field: "stage", to: "won" },
      conditions: [],
      actions: [{ type: "notify_me", title: "Ganhou {{title}}", body: "Parabéns" }],
      type_id: null,
      space_id: null,
      run_count: 0,
      last_run_at: null,
      ...overrides,
    },
  ]);
}

beforeEach(() => {
  enqueueJob.mockClear();
  notifyOwner.mockClear();
});

describe("runAutomations (job run_automations)", () => {
  it("gatilho e escopo batem: executa a ação e grava automation_runs como success", async () => {
    const fake = new FakeSupabase();
    fake.seed("items", [{ id: "item-1", owner_id: OWNER_ID, type_id: null, space_id: null, title: "Oportunidade X", status: "active", properties: { stage: "won" } }]);
    seedAutomation(fake);

    const payload = { event: { type: "property_changed", field: "stage", to: "won", from: "novo" }, itemId: "item-1", chainId: "chain-1", depth: 0 };
    const outcome = await runAutomations(job(payload), { supabase: fake as never });

    expect(outcome.status).toBe("done");
    expect(notifyOwner).toHaveBeenCalledTimes(1);
    expect(fake.rowsOf("automation_runs")).toHaveLength(1);
    expect(fake.rowsOf("automation_runs")[0]).toMatchObject({ status: "success", automation_id: "auto-1" });
    expect(fake.rowsOf("automations")[0]!.run_count).toBe(1);
  });

  it("gatilho não bate: nenhuma automação roda", async () => {
    const fake = new FakeSupabase();
    fake.seed("items", [{ id: "item-1", owner_id: OWNER_ID, type_id: null, space_id: null, title: "X", status: "active", properties: {} }]);
    seedAutomation(fake);

    const payload = { event: { type: "status_changed", to: "archived" }, itemId: "item-1", chainId: "chain-1", depth: 0 };
    await runAutomations(job(payload), { supabase: fake as never });

    expect(fake.rowsOf("automation_runs")).toHaveLength(0);
  });

  it("escopo por tipo não bate: nenhuma automação roda", async () => {
    const fake = new FakeSupabase();
    fake.seed("items", [{ id: "item-1", owner_id: OWNER_ID, type_id: "type-outro", space_id: null, title: "X", status: "active", properties: { stage: "won" } }]);
    seedAutomation(fake, { type_id: "type-1" });

    const payload = { event: { type: "property_changed", field: "stage", to: "won", from: "novo" }, itemId: "item-1", chainId: "chain-1", depth: 0 };
    await runAutomations(job(payload), { supabase: fake as never });

    expect(fake.rowsOf("automation_runs")).toHaveLength(0);
  });

  it("condições não passam: grava run 'skipped' e não executa ações", async () => {
    const fake = new FakeSupabase();
    fake.seed("items", [{ id: "item-1", owner_id: OWNER_ID, type_id: null, space_id: null, title: "X", status: "active", properties: { stage: "won", valor: 10 } }]);
    seedAutomation(fake, { conditions: [{ field: "valor", op: "gt", value: 1000 }] });

    const payload = { event: { type: "property_changed", field: "stage", to: "won", from: "novo" }, itemId: "item-1", chainId: "chain-1", depth: 0 };
    await runAutomations(job(payload), { supabase: fake as never });

    expect(notifyOwner).not.toHaveBeenCalled();
    expect(fake.rowsOf("automation_runs")[0]).toMatchObject({ status: "skipped" });
  });

  it("mesma automação já rodou nesta cadeia: proteção contra laço, sem novo run", async () => {
    const fake = new FakeSupabase();
    fake.seed("items", [{ id: "item-1", owner_id: OWNER_ID, type_id: null, space_id: null, title: "X", status: "active", properties: { stage: "won" } }]);
    seedAutomation(fake);
    fake.seed("automation_event_log", [{ id: "log-1", owner_id: OWNER_ID, item_id: "item-1", automation_id: "auto-1", chain_id: "chain-1" }]);

    const payload = { event: { type: "property_changed", field: "stage", to: "won", from: "novo" }, itemId: "item-1", chainId: "chain-1", depth: 0 };
    await runAutomations(job(payload), { supabase: fake as never });

    expect(fake.rowsOf("automation_runs")).toHaveLength(0);
  });

  it("profundidade acima do máximo: não roda nada", async () => {
    const fake = new FakeSupabase();
    fake.seed("items", [{ id: "item-1", owner_id: OWNER_ID, type_id: null, space_id: null, title: "X", status: "active", properties: { stage: "won" } }]);
    seedAutomation(fake);

    const payload = { event: { type: "property_changed", field: "stage", to: "won", from: "novo" }, itemId: "item-1", chainId: "chain-1", depth: 6 };
    const outcome = await runAutomations(job(payload), { supabase: fake as never });

    expect(outcome.status).toBe("done");
    expect(fake.rowsOf("automation_runs")).toHaveLength(0);
  });

  it("item não encontrado: done sem erro", async () => {
    const fake = new FakeSupabase();
    const payload = { event: { type: "item_created" }, itemId: "00000000-0000-0000-0000-000000000000", chainId: "chain-1", depth: 0 };
    const outcome = await runAutomations(job(payload), { supabase: fake as never });
    expect(outcome.status).toBe("done");
  });

  it("payload inválido: failed", async () => {
    const fake = new FakeSupabase();
    const outcome = await runAutomations(job({ nonsense: true }), { supabase: fake as never });
    expect(outcome.status).toBe("failed");
  });
});
