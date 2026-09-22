import { beforeEach, describe, expect, it, vi } from "vitest";

const enqueueJob = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob }));

const { emitItemEvent, emitTagAddedEvent } = await import("./emit-item-event");

beforeEach(() => {
  enqueueJob.mockClear();
});

describe("emitItemEvent", () => {
  it("before nulo: só item_created", async () => {
    await emitItemEvent({ ownerId: "owner-1", itemId: "item-1", before: null, after: { status: "active", properties: {} } });
    expect(enqueueJob).toHaveBeenCalledTimes(1);
    expect(enqueueJob.mock.calls[0]![0]).toMatchObject({
      ownerId: "owner-1",
      kind: "run_automations",
      payload: { event: { type: "item_created" }, itemId: "item-1" },
    });
  });

  it("status mudou: status_changed", async () => {
    await emitItemEvent({
      ownerId: "owner-1",
      itemId: "item-1",
      before: { status: "inbox", properties: {} },
      after: { status: "active", properties: {} },
    });
    expect(enqueueJob).toHaveBeenCalledTimes(1);
    expect(enqueueJob.mock.calls[0]![0].payload.event).toEqual({ type: "status_changed", to: "active" });
  });

  it("propriedade mudou: property_changed com from/to", async () => {
    await emitItemEvent({
      ownerId: "owner-1",
      itemId: "item-1",
      before: { status: "active", properties: { stage: "novo" } },
      after: { status: "active", properties: { stage: "won" } },
    });
    expect(enqueueJob).toHaveBeenCalledTimes(1);
    expect(enqueueJob.mock.calls[0]![0].payload.event).toEqual({ type: "property_changed", field: "stage", to: "won", from: "novo" });
  });

  it("várias propriedades mudaram: um job por propriedade", async () => {
    await emitItemEvent({
      ownerId: "owner-1",
      itemId: "item-1",
      before: { status: "active", properties: { a: 1, b: 1 } },
      after: { status: "active", properties: { a: 2, b: 2 } },
    });
    expect(enqueueJob).toHaveBeenCalledTimes(2);
  });

  it("nada mudou: nenhum job", async () => {
    await emitItemEvent({
      ownerId: "owner-1",
      itemId: "item-1",
      before: { status: "active", properties: { a: 1 } },
      after: { status: "active", properties: { a: 1 } },
    });
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it("mesmo chainId/depth informados são propagados (proteção contra laço, 5.3)", async () => {
    await emitItemEvent({
      ownerId: "owner-1",
      itemId: "item-1",
      before: null,
      after: { status: "active", properties: {} },
      chainId: "chain-1",
      depth: 2,
    });
    expect(enqueueJob.mock.calls[0]![0].payload).toMatchObject({ chainId: "chain-1", depth: 2 });
  });
});

describe("emitTagAddedEvent", () => {
  it("enfileira run_automations com o evento tag_added", async () => {
    await emitTagAddedEvent({ ownerId: "owner-1", itemId: "item-1", tag: "urgente" });
    expect(enqueueJob).toHaveBeenCalledTimes(1);
    expect(enqueueJob.mock.calls[0]![0]).toMatchObject({
      ownerId: "owner-1",
      kind: "run_automations",
      payload: { event: { type: "tag_added", tag: "urgente" }, itemId: "item-1" },
    });
  });
});
