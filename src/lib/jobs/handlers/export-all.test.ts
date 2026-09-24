import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fake-supabase";
import type { Job } from "../types";

const notifyOwner = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/messaging/notify-owner", () => ({ notifyOwner }));

const { exportAll } = await import("./export-all");

const OWNER_ID = "owner-1";

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: OWNER_ID,
    kind: "export_all",
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
    dedupe_key: "export_all",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as unknown as Job;
}

function fakeSupabaseWithStorage() {
  const fake = new FakeSupabase();
  const upload = vi.fn().mockResolvedValue({ error: null });
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://storage.example/signed-zip" }, error: null });
  const download = vi.fn().mockResolvedValue({ data: new Blob(["conteúdo"]) });
  (fake as unknown as { storage: unknown }).storage = { from: () => ({ upload, download, createSignedUrl }) };
  return { fake, upload, createSignedUrl, download };
}

beforeEach(() => {
  notifyOwner.mockClear();
});

describe("exportAll — sem nenhum dado ainda", () => {
  it("mesmo vazio, monta o zip, sobe pro Storage, registra o backup_run e avisa o dono", async () => {
    const { fake, upload, createSignedUrl } = fakeSupabaseWithStorage();

    const outcome = await exportAll(job(), { supabase: fake as never });

    expect(outcome).toMatchObject({ status: "done", result: { itemCount: 0, signedUrl: "https://storage.example/signed-zip" } });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]![0]).toContain(`${OWNER_ID}/exports/`);
    expect(createSignedUrl).toHaveBeenCalledWith(expect.stringContaining(`${OWNER_ID}/exports/`), 24 * 60 * 60, expect.objectContaining({ download: expect.stringContaining("hub-export-") }));

    const runs = fake.rowsOf("backup_runs");
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ owner_id: OWNER_ID, kind: "export", status: "success" });
    expect((runs[0]!.size_bytes as number) > 0).toBe(true);

    expect(notifyOwner).toHaveBeenCalledWith(OWNER_ID, expect.objectContaining({ text: expect.stringContaining("https://storage.example/signed-zip") }));
  });

  it("falha no upload: pede retry sem quebrar o job", async () => {
    const { fake, upload } = fakeSupabaseWithStorage();
    upload.mockResolvedValue({ error: { message: "Storage fora do ar" } });

    const outcome = await exportAll(job(), { supabase: fake as never });
    expect(outcome).toMatchObject({ status: "retry" });
    expect(notifyOwner).not.toHaveBeenCalled();
  });
});

describe("exportAll — com itens, contatos e lançamentos", () => {
  it("inclui item com espaço/tipo/tags/propriedades e contato no export, sem quebrar", async () => {
    const { fake, upload } = fakeSupabaseWithStorage();

    fake.seed("items", [
      {
        id: "item-1",
        owner_id: OWNER_ID,
        title: "Reunião de terça",
        status: "active",
        content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Pauta" }] }] },
        properties: { prioridade: "alta" },
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
        deleted_at: null,
        spaces: { name: "Trabalho" },
        object_types: {
          name: "Reunião",
          slug: "reuniao",
          fields: [{ key: "prioridade", label: "Prioridade", type: "select", options: [{ id: "alta", label: "Alta" }] }],
        },
      },
    ]);
    fake.seed("contacts", [
      { id: "contact-1", owner_id: OWNER_ID, name: "Maria", nickname: null, relationship: "friend", company: null, role: null, phone_e164: null, email: null, birthday: null, notes: null, archived_at: null, spaces: null },
    ]);

    const outcome = await exportAll(job(), { supabase: fake as never });

    expect(outcome).toMatchObject({ status: "done", result: { itemCount: 1 } });
    expect(upload).toHaveBeenCalledTimes(1);
  });
});
