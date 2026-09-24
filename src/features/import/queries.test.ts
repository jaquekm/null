import { describe, expect, it } from "vitest";
import { FakeSupabase } from "@/lib/testing/fake-supabase";
import { bulkUpsertTags, ensureImportedCalendar, getImportBatch, saveImportBatch, undoIcsImportBatch, undoItemImportBatch } from "./queries";

const OWNER_ID = "owner-1";
const BATCH_ID = "batch-1";

describe("undoItemImportBatch", () => {
  it("remove só os itens não editados desde o fim do lote (updated_at <= import_batches.created_at)", async () => {
    const fake = new FakeSupabase();
    await saveImportBatch(fake as never, { ownerId: OWNER_ID, id: BATCH_ID, source: "obsidian", itemsCreated: 2, itemsSkipped: 0 });
    // `import_batches.created_at` default do FakeSupabase é undefined — seta explícito, já que a comparação de datas depende dele.
    fake.rowsOf("import_batches")[0]!.created_at = "2026-01-10T00:00:00.000Z";

    fake.seed("items", [
      // criado bem antes (data original preservada), nunca editado depois do lote — remove.
      { id: "item-untouched", owner_id: OWNER_ID, deleted_at: null, updated_at: "2026-01-10T00:00:00.000Z", properties: { _import_id: BATCH_ID } },
      // dono editou depois que o lote terminou — mantém.
      { id: "item-edited", owner_id: OWNER_ID, deleted_at: null, updated_at: "2026-01-11T00:00:00.000Z", properties: { _import_id: BATCH_ID } },
      // de outro lote — nunca deveria ser tocado.
      { id: "item-other-batch", owner_id: OWNER_ID, deleted_at: null, updated_at: "2026-01-10T00:00:00.000Z", properties: { _import_id: "outro-lote" } },
    ]);

    const result = await undoItemImportBatch(fake as never, OWNER_ID, BATCH_ID, "2026-01-10T00:00:00.000Z");
    expect(result).toEqual({ removed: 1, kept: 1 });

    const items = fake.rowsOf("items");
    expect(items.find((i) => i.id === "item-untouched")!.deleted_at).not.toBeNull();
    expect(items.find((i) => i.id === "item-edited")!.deleted_at).toBeNull();
    expect(items.find((i) => i.id === "item-other-batch")!.deleted_at).toBeNull();

    const batch = await getImportBatch(fake as never, OWNER_ID, BATCH_ID);
    expect(batch!.status).toBe("undone");
  });

  it("item com created_at bem mais antigo que updated_at (data original preservada na importação) ainda é removido — não confunde 'nota antiga' com 'dono editou'", async () => {
    const fake = new FakeSupabase();
    await saveImportBatch(fake as never, { ownerId: OWNER_ID, id: BATCH_ID, source: "evernote", itemsCreated: 1, itemsSkipped: 0 });
    fake.rowsOf("import_batches")[0]!.created_at = "2026-01-10T00:00:00.000Z";

    fake.seed("items", [
      // nota de 2015 no Evernote, importada em 2026-01-10 — updated_at (hora da importação) bate com o fim do lote.
      { id: "item-old-note", owner_id: OWNER_ID, deleted_at: null, created_at: "2015-06-01T00:00:00.000Z", updated_at: "2026-01-10T00:00:00.000Z", properties: { _import_id: BATCH_ID } },
    ]);

    const result = await undoItemImportBatch(fake as never, OWNER_ID, BATCH_ID, "2026-01-10T00:00:00.000Z");
    expect(result).toEqual({ removed: 1, kept: 0 });
  });
});

describe("bulkUpsertTags", () => {
  it("cria uma tag por nome distinto (minúsculo) e devolve o mapa nome→id", async () => {
    const fake = new FakeSupabase();
    const map = await bulkUpsertTags(fake as never, OWNER_ID, ["Trabalho", "trabalho", "Urgente"]);
    expect(map.size).toBe(2);
    expect(fake.rowsOf("tags")).toHaveLength(2);
  });

  it("lista vazia: não toca a tabela", async () => {
    const fake = new FakeSupabase();
    const map = await bulkUpsertTags(fake as never, OWNER_ID, []);
    expect(map.size).toBe(0);
    expect(fake.rowsOf("tags")).toHaveLength(0);
  });
});

describe("ensureImportedCalendar", () => {
  it("cria o calendário local uma vez e reaproveita nas próximas chamadas", async () => {
    const fake = new FakeSupabase();
    const firstId = await ensureImportedCalendar(fake as never, OWNER_ID);
    const secondId = await ensureImportedCalendar(fake as never, OWNER_ID);
    expect(firstId).toBe(secondId);
    expect(fake.rowsOf("calendars")).toHaveLength(1);
    expect(fake.rowsOf("calendars")[0]).toMatchObject({ name: "Importado", connection_id: null, sync_enabled: false });
  });
});

describe("undoIcsImportBatch", () => {
  it("apaga só os eventos guardados em detail.eventIds e marca o lote como desfeito", async () => {
    const fake = new FakeSupabase();
    await saveImportBatch(fake as never, { ownerId: OWNER_ID, id: BATCH_ID, source: "ics", itemsCreated: 2, itemsSkipped: 0, detail: { eventIds: ["evt-1", "evt-2"] } as never });
    fake.seed("events", [
      { id: "evt-1", owner_id: OWNER_ID },
      { id: "evt-2", owner_id: OWNER_ID },
      { id: "evt-3", owner_id: OWNER_ID },
    ]);

    const batch = await getImportBatch(fake as never, OWNER_ID, BATCH_ID);
    const removed = await undoIcsImportBatch(fake as never, OWNER_ID, batch!);
    expect(removed).toBe(2);
    expect(fake.rowsOf("events").map((e) => e.id)).toEqual(["evt-3"]);
    expect((await getImportBatch(fake as never, OWNER_ID, BATCH_ID))!.status).toBe("undone");
  });
});
