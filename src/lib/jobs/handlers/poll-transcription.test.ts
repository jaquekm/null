import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../types";

const applyTranscriptionResultMock = vi.fn();
vi.mock("@/features/transcripts/lib/apply-result", () => ({ applyTranscriptionResult: applyTranscriptionResultMock }));

const fetchResultMock = vi.fn();
const getTranscriptionProviderMock = vi.fn();
vi.mock("@/lib/transcription", () => ({ getTranscriptionProvider: getTranscriptionProviderMock }));

const { pollTranscription } = await import("./poll-transcription");

function fakeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: "owner-1",
    kind: "poll_transcription",
    payload: { transcriptId: "11111111-1111-4111-8111-111111111111" },
    status: "running",
    priority: 100,
    attempts: 1,
    max_attempts: 15,
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

function fakeSupabase(transcript: Record<string, unknown> | null) {
  const updateCalls: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: transcript, error: null }) }) }),
      update: (values: Record<string, unknown>) => {
        updateCalls.push(values);
        return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) };
      },
    }),
  };
  return { client: client as never, updateCalls };
}

const processingTranscript = {
  id: "t1",
  owner_id: "owner-1",
  item_id: "item-1",
  provider: "assemblyai",
  external_id: "ext-1",
  status: "processing",
  summarize: false,
  created_at: "2026-09-19T00:00:00.000Z",
};

describe("pollTranscription", () => {
  beforeEach(() => {
    fetchResultMock.mockReset();
    applyTranscriptionResultMock.mockReset();
    getTranscriptionProviderMock.mockReset();
    getTranscriptionProviderMock.mockReturnValue({ name: "assemblyai", fetchResult: fetchResultMock });
    vi.useRealTimers();
  });

  it("já não está 'processing' (webhook resolveu antes): done sem consultar o provedor", async () => {
    const { client } = fakeSupabase({ ...processingTranscript, status: "completed" });
    const outcome = await pollTranscription(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done" });
    expect(fetchResultMock).not.toHaveBeenCalled();
  });

  it("transcript não encontrado: done (apagado nesse meio tempo)", async () => {
    const { client } = fakeSupabase(null);
    const outcome = await pollTranscription(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done" });
  });

  it("ainda processando e dentro do prazo: retry com delay de 30 min", async () => {
    fetchResultMock.mockResolvedValue({ status: "processing" });
    applyTranscriptionResultMock.mockResolvedValue("processing");
    const { client } = fakeSupabase({ ...processingTranscript, created_at: new Date().toISOString() });

    const outcome = await pollTranscription(fakeJob(), { supabase: client });

    expect(outcome).toMatchObject({ status: "retry", delaySeconds: 30 * 60 });
  });

  it("completed: aplica o resultado e devolve done", async () => {
    fetchResultMock.mockResolvedValue({ status: "completed", text: "x", segments: [], durationSeconds: 5 });
    applyTranscriptionResultMock.mockResolvedValue("completed");
    const { client } = fakeSupabase(processingTranscript);

    const outcome = await pollTranscription(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done" });
    expect(applyTranscriptionResultMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ id: "t1", ownerId: "owner-1", itemId: "item-1", provider: "assemblyai" }),
      { status: "completed", text: "x", segments: [], durationSeconds: 5 },
    );
  });

  it("continua processando depois de 6h: falha com tempo limite excedido, sem novo retry", async () => {
    fetchResultMock.mockResolvedValue({ status: "processing" });
    applyTranscriptionResultMock.mockResolvedValue("processing");
    const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    const { client, updateCalls } = fakeSupabase({ ...processingTranscript, created_at: sevenHoursAgo });

    const outcome = await pollTranscription(fakeJob(), { supabase: client });

    expect(outcome).toMatchObject({ status: "failed" });
    expect(updateCalls[0]).toMatchObject({ status: "failed" });
  });

  it("sem external_id (estado inconsistente): failed", async () => {
    const { client } = fakeSupabase({ ...processingTranscript, external_id: null });
    const outcome = await pollTranscription(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "failed" });
    expect(fetchResultMock).not.toHaveBeenCalled();
  });

  it("sem provedor configurado: failed", async () => {
    getTranscriptionProviderMock.mockReturnValue(null);
    const { client } = fakeSupabase(processingTranscript);
    const outcome = await pollTranscription(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "failed" });
  });
});
