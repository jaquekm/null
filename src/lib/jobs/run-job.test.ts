import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job, JobHandler } from "./types";

const getOwnerNotificationPreferencesMock = vi.fn();
vi.mock("@/features/settings/queries", () => ({ getOwnerNotificationPreferences: getOwnerNotificationPreferencesMock }));

const notifyOwnerMock = vi.fn();
vi.mock("@/lib/messaging/notify-owner", () => ({ notifyOwner: notifyOwnerMock }));

const { runJob } = await import("./run-job");

function fakeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: "owner-1",
    kind: "test_kind",
    payload: {},
    status: "running",
    priority: 100,
    attempts: 1,
    max_attempts: 5,
    run_after: "2026-09-19T00:00:00.000Z",
    locked_at: "2026-09-19T00:00:00.000Z",
    finished_at: null,
    last_error: null,
    result: null,
    dedupe_key: null,
    created_at: "2026-09-19T00:00:00.000Z",
    updated_at: "2026-09-19T00:00:00.000Z",
    ...overrides,
  };
}

/** Cliente Supabase falso que só grava o payload do último `.update()` — o suficiente pro que `runJob` faz. */
function fakeSupabase() {
  let lastUpdate: Record<string, unknown> | null = null;
  const client = {
    from: () => ({
      update: (values: Record<string, unknown>) => {
        lastUpdate = values;
        return { eq: () => Promise.resolve({ data: null, error: null }) };
      },
    }),
  };
  return { client: client as never, getLastUpdate: () => lastUpdate };
}

describe("runJob", () => {
  beforeEach(() => {
    getOwnerNotificationPreferencesMock.mockReset().mockResolvedValue({
      remindersPersonal: true,
      shareComments: true,
      jobFailures: true,
      googleReconnect: true,
    });
    notifyOwnerMock.mockReset();
  });

  it("done: persiste status='done' e o resultado do handler", async () => {
    const { client, getLastUpdate } = fakeSupabase();
    const handler: JobHandler = async () => ({ status: "done", result: { ok: true } });

    await runJob(client, fakeJob(), { test_kind: handler });

    expect(getLastUpdate()).toMatchObject({ status: "done", result: { ok: true } });
  });

  it("retry: volta pra queued com run_after no futuro e guarda o erro", async () => {
    const { client, getLastUpdate } = fakeSupabase();
    const handler: JobHandler = async () => ({ status: "retry", error: "timeout" });

    await runJob(client, fakeJob({ attempts: 1, max_attempts: 5 }), { test_kind: handler });

    const update = getLastUpdate();
    expect(update).toMatchObject({ status: "queued", last_error: "timeout" });
    expect(new Date(update!.run_after as string).getTime()).toBeGreaterThan(Date.now());
  });

  it("failed: termina sem novas tentativas mesmo com attempts < max_attempts", async () => {
    const { client, getLastUpdate } = fakeSupabase();
    const handler: JobHandler = async () => ({ status: "failed", error: "orçamento estourado" });

    await runJob(client, fakeJob({ attempts: 1, max_attempts: 5 }), { test_kind: handler });

    expect(getLastUpdate()).toMatchObject({ status: "failed", last_error: "orçamento estourado" });
  });

  it("failed: avisa o dono por push (preferência ligada por padrão)", async () => {
    const { client } = fakeSupabase();
    const handler: JobHandler = async () => ({ status: "failed", error: "orçamento estourado" });

    await runJob(client, fakeJob({ owner_id: "owner-1", kind: "test_kind" }), { test_kind: handler });

    expect(notifyOwnerMock).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({ text: expect.stringContaining("orçamento estourado") }),
    );
  });

  it("failed: não avisa quando o dono desligou 'falhas de jobs'", async () => {
    getOwnerNotificationPreferencesMock.mockResolvedValue({
      remindersPersonal: true,
      shareComments: true,
      jobFailures: false,
      googleReconnect: true,
    });
    const { client } = fakeSupabase();
    const handler: JobHandler = async () => ({ status: "failed", error: "x" });

    await runJob(client, fakeJob(), { test_kind: handler });

    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("done/retry: não avisa o dono (só 'failed' dispara)", async () => {
    const { client } = fakeSupabase();
    const handler: JobHandler = async () => ({ status: "done" });

    await runJob(client, fakeJob(), { test_kind: handler });

    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("exceção não tratada no handler vira retry, não derruba o tick", async () => {
    const { client, getLastUpdate } = fakeSupabase();
    const handler: JobHandler = async () => {
      throw new Error("falha de rede");
    };

    await runJob(client, fakeJob({ attempts: 1, max_attempts: 5 }), { test_kind: handler });

    expect(getLastUpdate()).toMatchObject({ status: "queued", last_error: "falha de rede" });
  });

  it("kind sem handler registrado vira failed direto", async () => {
    const { client, getLastUpdate } = fakeSupabase();

    await runJob(client, fakeJob({ kind: "kind_desconhecido" }), {});

    expect(getLastUpdate()).toMatchObject({ status: "failed" });
    expect((getLastUpdate()!.last_error as string).includes("kind_desconhecido")).toBe(true);
  });

  it("exceção esgotando as tentativas vira failed", async () => {
    const { client, getLastUpdate } = fakeSupabase();
    const handler: JobHandler = vi.fn(async () => {
      throw new Error("de novo");
    });

    await runJob(client, fakeJob({ attempts: 5, max_attempts: 5 }), { test_kind: handler });

    expect(getLastUpdate()).toMatchObject({ status: "failed", last_error: "de novo" });
  });
});
