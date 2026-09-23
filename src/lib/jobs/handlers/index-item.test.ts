import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentHash } from "@/features/ai/lib/chunking";
import { FakeSupabase, fakeUuid } from "@/lib/testing/fake-supabase";
import type { Job } from "../types";

const embedDocuments = vi.fn().mockResolvedValue([]);
const provider = { model: "voyage-3", dimensions: 1024, embedDocuments, embedQuery: vi.fn() };
const getEmbeddingsProvider = vi.fn(() => provider);
vi.mock("@/lib/embeddings", () => ({ getEmbeddingsProvider: () => getEmbeddingsProvider() }));

const { indexItem } = await import("./index-item");

const OWNER_ID = "owner-1";
const ITEM_ID = fakeUuid(1);

function job(): Job {
  return {
    id: "job-1",
    owner_id: OWNER_ID,
    kind: "index_item",
    payload: { itemId: ITEM_ID },
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

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    owner_id: OWNER_ID,
    title: "Item de teste",
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Corpo do item." }] }] },
    content_text: "Corpo do item.",
    extra_text: "",
    properties: {},
    space_id: null,
    type_id: null,
    deleted_at: null,
    indexed_hash: null,
    ...overrides,
  };
}

function fakeSupabase() {
  const fake = new FakeSupabase();
  fake.seed("user_settings", [{ owner_id: OWNER_ID, modules: { ai: true }, preferences: {} }]);
  return fake;
}

beforeEach(() => {
  embedDocuments.mockClear();
  embedDocuments.mockResolvedValue([]);
  getEmbeddingsProvider.mockClear();
  getEmbeddingsProvider.mockReturnValue(provider);
});

describe("indexItem — condições de pular", () => {
  it("item excluído: apaga trechos existentes e não gera nada novo", async () => {
    const fake = fakeSupabase();
    fake.seed("items", [baseItem({ deleted_at: "2026-01-01T00:00:00.000Z" })]);
    fake.seed("item_chunks", [{ id: "c1", item_id: ITEM_ID, owner_id: OWNER_ID, source: "content", content_hash: "x" }]);

    const outcome = await indexItem(job(), { supabase: fake as never });

    expect(outcome).toMatchObject({ status: "done", result: { skipped: "deleted" } });
    expect(fake.rowsOf("item_chunks")).toHaveLength(0);
    expect(embedDocuments).not.toHaveBeenCalled();
  });

  it("item inexistente: mesmo comportamento de excluído", async () => {
    const fake = fakeSupabase();
    const outcome = await indexItem(job(), { supabase: fake as never });
    expect(outcome).toMatchObject({ status: "done", result: { skipped: "deleted" } });
  });

  it("módulo de IA desligado: apaga trechos e pula", async () => {
    const fake = new FakeSupabase();
    fake.seed("user_settings", [{ owner_id: OWNER_ID, modules: { ai: false }, preferences: {} }]);
    fake.seed("items", [baseItem()]);
    fake.seed("item_chunks", [{ id: "c1", item_id: ITEM_ID, owner_id: OWNER_ID, source: "content", content_hash: "x" }]);

    const outcome = await indexItem(job(), { supabase: fake as never });

    expect(outcome).toMatchObject({ status: "done", result: { skipped: "ai_disabled" } });
    expect(fake.rowsOf("item_chunks")).toHaveLength(0);
  });

  it("espaço com ai_enabled=false: apaga trechos e pula", async () => {
    const fake = fakeSupabase();
    const spaceId = fakeUuid(2);
    fake.seed("spaces", [{ id: spaceId, owner_id: OWNER_ID, ai_enabled: false }]);
    fake.seed("items", [baseItem({ space_id: spaceId })]);
    fake.seed("item_chunks", [{ id: "c1", item_id: ITEM_ID, owner_id: OWNER_ID, source: "content", content_hash: "x" }]);

    const outcome = await indexItem(job(), { supabase: fake as never });

    expect(outcome).toMatchObject({ status: "done", result: { skipped: "space_ai_disabled" } });
    expect(fake.rowsOf("item_chunks")).toHaveLength(0);
  });

  it("espaço com ai_enabled=true: não pula por causa do espaço", async () => {
    const fake = fakeSupabase();
    const spaceId = fakeUuid(2);
    fake.seed("spaces", [{ id: spaceId, owner_id: OWNER_ID, ai_enabled: true }]);
    fake.seed("items", [baseItem({ space_id: spaceId })]);
    embedDocuments.mockResolvedValue([[0.1, 0.2]]);

    const outcome = await indexItem(job(), { supabase: fake as never });
    expect(outcome.status).toBe("done");
    expect((outcome as { result: { skipped?: string } }).result.skipped).toBeUndefined();
  });

  it("sem provedor de embeddings configurado: pula sem apagar nada", async () => {
    getEmbeddingsProvider.mockReturnValue(null as unknown as typeof provider);
    const fake = fakeSupabase();
    fake.seed("items", [baseItem()]);
    fake.seed("item_chunks", [{ id: "c1", item_id: ITEM_ID, owner_id: OWNER_ID, source: "content", content_hash: "x" }]);

    const outcome = await indexItem(job(), { supabase: fake as never });

    expect(outcome).toMatchObject({ status: "done", result: { skipped: "no_provider" } });
    expect(fake.rowsOf("item_chunks")).toHaveLength(1); // não mexeu
  });

  it("hash igual ao já indexado: pula sem chamar o provedor", async () => {
    const fake = fakeSupabase();
    const item = baseItem();
    const hash = contentHash(JSON.stringify({ title: item.title, contentText: item.content_text, extraText: item.extra_text, properties: item.properties }));
    fake.seed("items", [{ ...item, indexed_hash: hash }]);

    const outcome = await indexItem(job(), { supabase: fake as never });

    expect(outcome).toMatchObject({ status: "done", result: { skipped: "unchanged" } });
    expect(embedDocuments).not.toHaveBeenCalled();
  });
});

describe("indexItem — indexação de verdade", () => {
  it("gera trecho de conteúdo, embeda e grava indexed_hash/indexed_at", async () => {
    const fake = fakeSupabase();
    fake.seed("items", [baseItem()]);
    embedDocuments.mockResolvedValue([[0.1, 0.2, 0.3]]);

    const outcome = await indexItem(job(), { supabase: fake as never });

    expect(outcome).toMatchObject({ status: "done", result: { chunks: 1, embedded: 1, reused: 0 } });
    expect(embedDocuments).toHaveBeenCalledTimes(1);

    const chunks = fake.rowsOf("item_chunks");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ source: "content", embedding_model: "voyage-3" });
    expect(chunks[0]!.embedding).toEqual([0.1, 0.2, 0.3]);

    const updatedItem = fake.rowsOf("items")[0]!;
    expect(updatedItem.indexed_hash).toBeTruthy();
    expect(updatedItem.indexed_at).toBeTruthy();

    const usage = fake.rowsOf("usage_events");
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ provider: "embeddings", feature: "index_item", model: "voyage-3", item_id: ITEM_ID });
  });

  it("inclui trecho de propriedades, pulando contact/money por padrão", async () => {
    const fake = fakeSupabase();
    fake.seed("items", [
      baseItem({
        properties: { titulo_curto: "Valor simples", responsavel: "contact-1", preco: 500 },
        object_types: { fields: [
          { key: "titulo_curto", label: "Resumo", type: "text" },
          { key: "responsavel", label: "Responsável", type: "contact" },
          { key: "preco", label: "Preço", type: "money" },
        ] },
      }),
    ]);
    embedDocuments.mockResolvedValue([[1], [2]]);

    await indexItem(job(), { supabase: fake as never });

    const chunks = fake.rowsOf("item_chunks");
    const propertiesChunk = chunks.find((c) => c.source === "properties");
    expect(propertiesChunk).toBeDefined();
    expect(propertiesChunk!.content).toBe("Resumo: Valor simples");
  });

  it("inclui contact/money quando includeFinanceContacts está ligado nas preferências", async () => {
    const fake = new FakeSupabase();
    fake.seed("user_settings", [{ owner_id: OWNER_ID, modules: { ai: true }, preferences: { indexFinanceContacts: true } }]);
    fake.seed("contacts", [{ id: "contact-1", owner_id: OWNER_ID, name: "Ana Souza" }]);
    fake.seed("items", [
      baseItem({
        properties: { responsavel: "contact-1" },
        object_types: { fields: [{ key: "responsavel", label: "Responsável", type: "contact" }] },
      }),
    ]);
    embedDocuments.mockResolvedValue([[1], [2]]);

    await indexItem(job(), { supabase: fake as never });

    const chunks = fake.rowsOf("item_chunks");
    const propertiesChunk = chunks.find((c) => c.source === "properties");
    expect(propertiesChunk!.content).toBe("Responsável: Ana Souza");
  });

  it("gera um trecho por anexo com texto extraído e um por janela de transcrição", async () => {
    const fake = fakeSupabase();
    fake.seed("items", [baseItem({ content: null, content_text: "" })]);
    fake.seed("attachments", [{ id: "att-1", item_id: ITEM_ID, extraction_status: "done", extracted_text: "Texto do PDF extraído.", page_count: null }]);
    fake.seed("transcripts", [
      { id: "trs-1", item_id: ITEM_ID, status: "completed", segments: [{ speaker: "A", start: 0, end: 1, text: "Oi" }], speaker_names: { A: "João" } },
    ]);
    embedDocuments.mockResolvedValue([[1], [2]]);

    const outcome = await indexItem(job(), { supabase: fake as never });

    expect(outcome).toMatchObject({ status: "done", result: { chunks: 2 } });
    const sources = fake.rowsOf("item_chunks").map((c) => c.source);
    expect(sources.sort()).toEqual(["attachment", "transcript"]);
  });

  it("reaproveita embedding de trecho com o mesmo content_hash (texto idêntico a uma execução anterior)", async () => {
    const fake = fakeSupabase();
    const item = baseItem();
    fake.seed("items", [item]);

    // A primeira rodada de verdade calcularia esse hash pro único trecho de conteúdo do item.
    const draftHash = contentHash("Item de teste\n\nCorpo do item.");
    fake.seed("item_chunks", [
      { id: "old-1", item_id: ITEM_ID, owner_id: OWNER_ID, source: "content", source_id: null, chunk_index: 0, content: "Item de teste\n\nCorpo do item.", content_hash: draftHash, embedding: [9, 9, 9], embedding_model: "voyage-3", token_estimate: 10, metadata: {} },
    ]);

    const outcome = await indexItem(job(), { supabase: fake as never });

    expect(outcome).toMatchObject({ status: "done", result: { chunks: 1, embedded: 0, reused: 1 } });
    expect(embedDocuments).not.toHaveBeenCalled();
    expect(fake.rowsOf("usage_events")).toHaveLength(0); // reaproveitamento total não gera custo

    const chunks = fake.rowsOf("item_chunks");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.embedding).toEqual([9, 9, 9]);
  });
});
