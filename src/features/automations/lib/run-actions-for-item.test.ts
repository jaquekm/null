import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { FakeSupabase } from "@/lib/testing/fake-supabase";

const enqueueJob = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob }));

const notifyOwner = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/messaging/notify-owner", () => ({ notifyOwner }));

vi.mock("@/lib/env", () => ({ serverEnv: { AUTOMATION_WEBHOOK_URL: "https://n8n.example.com/hook", N8N_WEBHOOK_SECRET: "s3gredo" } }));

const { runActionsForItem } = await import("./run-actions-for-item");

const OWNER_ID = "owner-1";

function client(fake: FakeSupabase) {
  return fake as unknown as SupabaseClient<Database>;
}

function automation(overrides: Record<string, unknown> = {}) {
  return {
    id: "auto-1",
    owner_id: OWNER_ID,
    name: "x",
    conditions: [],
    actions: [{ type: "notify_me", title: "Oi", body: "Corpo" }],
    ...overrides,
  } as never;
}

const ITEM = { id: "item-1", typeId: null, spaceId: null, title: "X", status: "active", properties: {} };

beforeEach(() => {
  notifyOwner.mockClear();
});

describe("runActionsForItem", () => {
  it("condições e ações válidas: roda até o fim com sucesso", async () => {
    const fake = new FakeSupabase();
    const outcome = await runActionsForItem(client(fake), OWNER_ID, automation(), ITEM, "chain-1", 1);
    expect(outcome).toMatchObject({ conditionsPassed: true, failed: false });
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("actions em formato inválido (ex.: vindo de um pack malformado): falha sem executar nada", async () => {
    const fake = new FakeSupabase();
    const outcome = await runActionsForItem(client(fake), OWNER_ID, automation({ actions: [{ type: "set_property" }] }), ITEM, "chain-1", 1);
    expect(outcome.conditionsPassed).toBe(true);
    expect(outcome.failed).toBe(true);
    expect(outcome.error).toContain("inválido");
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it("conditions em formato inválido: falha sem executar nada", async () => {
    const fake = new FakeSupabase();
    const outcome = await runActionsForItem(client(fake), OWNER_ID, automation({ conditions: [{ field: "x" }] }), ITEM, "chain-1", 1);
    expect(outcome.failed).toBe(true);
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it("sem item (automação de schedule): condições passam por vazio", async () => {
    const fake = new FakeSupabase();
    const outcome = await runActionsForItem(client(fake), OWNER_ID, automation(), null, "chain-1", 1);
    expect(outcome.conditionsPassed).toBe(true);
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("para na primeira ação que falhar", async () => {
    const fake = new FakeSupabase();
    const outcome = await runActionsForItem(
      client(fake),
      OWNER_ID,
      automation({
        actions: [
          { type: "set_property", field: "x", value: 1 }, // sem item na fake, ok — item existe
          { type: "call_webhook", url: "https://nao-permitida.example.com" }, // sempre falha sem AUTOMATION_WEBHOOK_URL
          { type: "notify_me", title: "nunca chega aqui", body: "x" },
        ],
      }),
      ITEM,
      "chain-1",
      1,
    );
    expect(outcome.failed).toBe(true);
    expect(outcome.actionResults).toHaveLength(2); // parou antes da terceira
    expect(notifyOwner).not.toHaveBeenCalled();
  });
});
