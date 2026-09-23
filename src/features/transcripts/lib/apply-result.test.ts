import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptionResult } from "@/lib/transcription/types";

const enqueueJobMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob: enqueueJobMock }));

const { applyTranscriptionResult } = await import("./apply-result");

interface MockConfig {
  transcriptsUpdateResult?: { data: { id: string }[] | null; error: unknown };
  rpcError?: unknown;
  itemTypeSlug?: string | null;
}

function makeSupabase(config: MockConfig = {}) {
  const transcriptsUpdateResult = config.transcriptsUpdateResult ?? { data: [{ id: "t1" }], error: null };
  const rpc = vi.fn().mockResolvedValue({ error: config.rpcError ?? null });
  const insertCalls: { table: string; row: Record<string, unknown> }[] = [];

  function thenable(result: unknown) {
    return { then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve) };
  }

  function builder(table: string) {
    const obj: Record<string, unknown> = {
      update: () => obj,
      eq: () => obj,
      // `.select()` é terminal em `transcripts` (pega as linhas afetadas pelo
      // update) mas encadeia mais (`.eq().maybeSingle()`) em `items` — o
      // código de verdade usa os dois jeitos.
      select: () => (table === "transcripts" ? thenable(transcriptsUpdateResult) : obj),
      insert: (row: Record<string, unknown>) => {
        insertCalls.push({ table, row });
        return Promise.resolve({ error: null });
      },
      maybeSingle: () =>
        Promise.resolve({
          data: config.itemTypeSlug !== undefined ? { object_types: config.itemTypeSlug ? { slug: config.itemTypeSlug } : null } : null,
          error: null,
        }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    return obj;
  }

  const from = vi.fn((table: string) => builder(table));

  return { from, rpc, insertCalls } as unknown as Parameters<typeof applyTranscriptionResult>[0] & {
    rpc: typeof rpc;
    insertCalls: typeof insertCalls;
  };
}

const transcript = { id: "t1", ownerId: "owner-1", itemId: "item-1", provider: "assemblyai", summarize: false };

describe("applyTranscriptionResult", () => {
  beforeEach(() => {
    enqueueJobMock.mockClear();
  });

  it("processing: não toca no banco, devolve 'processing'", async () => {
    const supabase = makeSupabase();
    const result: TranscriptionResult = { status: "processing" };

    await expect(applyTranscriptionResult(supabase, transcript, result)).resolves.toBe("processing");
    expect(supabase.from).not.toHaveBeenCalled();
    expect(enqueueJobMock).not.toHaveBeenCalled();
  });

  it("failed: atualiza status/error, não enfileira resumo", async () => {
    const supabase = makeSupabase();
    const result: TranscriptionResult = { status: "failed", error: "arquivo corrompido" };

    await expect(applyTranscriptionResult(supabase, transcript, result)).resolves.toBe("failed");
    expect(supabase.from).toHaveBeenCalledWith("transcripts");
    expect(enqueueJobMock).not.toHaveBeenCalled();
  });

  it("completed, item comum sem summarize: salva, registra uso, enfileira index_item mas não resumo", async () => {
    const supabase = makeSupabase({ itemTypeSlug: null });
    const result: TranscriptionResult = {
      status: "completed",
      text: "olá",
      segments: [{ speaker: "A", start: 0, end: 1, text: "olá" }],
      durationSeconds: 120,
    };

    await expect(applyTranscriptionResult(supabase, transcript, result)).resolves.toBe("completed");
    expect(supabase.rpc).toHaveBeenCalledWith("refresh_item_extra_text", { p_item_id: "item-1" });
    expect(supabase.insertCalls).toEqual([
      expect.objectContaining({ table: "usage_events", row: expect.objectContaining({ provider: "transcription" }) }),
    ]);
    expect(enqueueJobMock).toHaveBeenCalledTimes(1);
    expect(enqueueJobMock).toHaveBeenCalledWith(expect.objectContaining({ kind: "index_item", payload: { itemId: "item-1" } }));
  });

  it("completed, item do tipo Reunião: enfileira summarize_transcript mesmo sem summarize", async () => {
    const supabase = makeSupabase({ itemTypeSlug: "reuniao" });
    const result: TranscriptionResult = { status: "completed", text: "ata", segments: [], durationSeconds: 60 };

    await applyTranscriptionResult(supabase, transcript, result);

    expect(enqueueJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "summarize_transcript", payload: { transcriptId: "t1" }, dedupeKey: "summarize:t1" }),
    );
  });

  it("completed, summarize=true num item que não é Reunião: também enfileira (index_item + summarize_transcript)", async () => {
    const supabase = makeSupabase({ itemTypeSlug: null });
    const result: TranscriptionResult = { status: "completed", text: "nota", segments: [], durationSeconds: 30 };

    await applyTranscriptionResult(supabase, { ...transcript, summarize: true }, result);

    expect(enqueueJobMock).toHaveBeenCalledTimes(2);
    expect(enqueueJobMock).toHaveBeenCalledWith(expect.objectContaining({ kind: "summarize_transcript" }));
  });

  it("idempotente: se o update não afeta nenhuma linha (já resolvido antes), não repete os efeitos colaterais", async () => {
    const supabase = makeSupabase({ transcriptsUpdateResult: { data: [], error: null }, itemTypeSlug: "reuniao" });
    const result: TranscriptionResult = { status: "completed", text: "x", segments: [], durationSeconds: 10 };

    await expect(applyTranscriptionResult(supabase, transcript, result)).resolves.toBe("completed");
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.insertCalls).toEqual([]);
    expect(enqueueJobMock).not.toHaveBeenCalled();
  });
});
