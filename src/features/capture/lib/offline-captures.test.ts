import { describe, expect, it, vi } from "vitest";
import { flushOfflineCaptures, flushSummary, pendingCapturesLabel, type FlushDeps, type QueuedCapture } from "./offline-captures";

function entry(id: string, text: string, overrides: Partial<QueuedCapture> = {}): QueuedCapture {
  return { id, text, spaceId: null, typeId: null, createdAt: `2026-09-30T1${id}:00:00.000Z`, ...overrides };
}

function deps(queue: QueuedCapture[], overrides: Partial<FlushDeps> = {}) {
  const store = [...queue];
  const base: FlushDeps = {
    list: async () => store,
    remove: vi.fn(async (id: string) => {
      const index = store.findIndex((item) => item.id === id);
      if (index >= 0) store.splice(index, 1);
    }),
    capture: vi.fn(async () => ({ ok: true as const })),
    createReminder: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  };
  return { deps: base, store };
}

describe("flushOfflineCaptures", () => {
  it("envia na ordem em que foram escritas e esvazia a fila", async () => {
    const { deps: d, store } = deps([entry("2", "Segunda"), entry("1", "Primeira")]);
    const result = await flushOfflineCaptures(d);
    expect(result).toEqual({ captured: 2, reminders: 0, kept: 0, interrupted: false });
    expect(vi.mocked(d.capture).mock.calls.map((call) => call[0])).toEqual(["Primeira", "Segunda"]);
    expect(store).toHaveLength(0);
  });

  it("'me lembra de…' vira lembrete com o relógio de quando foi escrito", async () => {
    const { deps: d } = deps([entry("1", "me lembra de ligar pro dentista daqui a 2 horas")]);
    const result = await flushOfflineCaptures(d);
    expect(result.reminders).toBe(1);
    expect(d.createReminder).toHaveBeenCalledWith({ phrase: "me lembra de ligar pro dentista daqui a 2 horas", referenceAt: "2026-09-30T11:00:00.000Z" });
    expect(d.capture).not.toHaveBeenCalled();
  });

  it("lembrete que não dá mais (horário passou) entra como nota — nada se perde", async () => {
    const { deps: d } = deps([entry("1", "me lembra de x daqui a 10 minutos")], { createReminder: vi.fn(async () => ({ ok: false as const, error: "já passou" })) });
    const result = await flushOfflineCaptures(d);
    expect(result).toMatchObject({ captured: 1, reminders: 0 });
    expect(d.capture).toHaveBeenCalledWith("me lembra de x daqui a 10 minutos", null, null);
  });

  it("espaço/tipo que sumiu: tenta de novo no Inbox", async () => {
    const capture = vi.fn(async (_text: string, spaceId: string | null) => (spaceId ? { ok: false as const, error: "espaço" } : { ok: true as const }));
    const { deps: d } = deps([entry("1", "Nota", { spaceId: "s1" })], { capture });
    const result = await flushOfflineCaptures(d);
    expect(result.captured).toBe(1);
    expect(capture).toHaveBeenLastCalledWith("Nota", null, null);
  });

  it("recusada de vez: continua guardada", async () => {
    const { deps: d, store } = deps([entry("1", "Nota")], { capture: vi.fn(async () => ({ ok: false as const, error: "x" })) });
    const result = await flushOfflineCaptures(d);
    expect(result).toMatchObject({ captured: 0, kept: 1 });
    expect(store).toHaveLength(1);
  });

  it("a rede cai no meio: para e deixa o resto pra depois", async () => {
    const capture = vi.fn().mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { deps: d, store } = deps([entry("1", "A"), entry("2", "B"), entry("3", "C")], { capture });
    const result = await flushOfflineCaptures(d);
    expect(result).toEqual({ captured: 1, reminders: 0, kept: 0, interrupted: true });
    expect(store.map((item) => item.text)).toEqual(["B", "C"]);
  });
});

describe("textos", () => {
  it("contagem e resumo", () => {
    expect(pendingCapturesLabel(1)).toBe("1 captura esperando internet");
    expect(pendingCapturesLabel(3)).toBe("3 capturas esperando internet");
    expect(flushSummary({ captured: 2, reminders: 1, kept: 0, interrupted: false })).toBe("Internet de volta — enviei 2 capturas e 1 lembrete feitos sem conexão.");
    expect(flushSummary({ captured: 0, reminders: 0, kept: 1, interrupted: false })).toBeNull();
  });
});
