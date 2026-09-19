import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../types";

const enqueueJobMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../enqueue", () => ({ enqueueJob: enqueueJobMock }));

vi.mock("@/lib/env", () => ({ serverEnv: { APP_URL: "https://hub.example" } }));

const submitMock = vi.fn();
const getTranscriptionProviderMock = vi.fn();
vi.mock("@/lib/transcription", () => ({ getTranscriptionProvider: getTranscriptionProviderMock }));

const { transcribeAudio } = await import("./transcribe-audio");

function fakeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: "owner-1",
    kind: "transcribe_audio",
    payload: { transcriptId: "11111111-1111-4111-8111-111111111111" },
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

interface Config {
  transcript?: Record<string, unknown> | null;
  attachment?: Record<string, unknown> | null;
  signedUrl?: { signedUrl: string } | null;
  signError?: unknown;
  updateError?: unknown;
}

function fakeSupabase(config: Config) {
  const updateCalls: Record<string, unknown>[] = [];
  const client = {
    from: (table: string) => {
      if (table === "transcripts") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: config.transcript ?? null, error: null }) }),
          }),
          update: (values: Record<string, unknown>) => {
            updateCalls.push(values);
            return { eq: () => Promise.resolve({ error: config.updateError ?? null }) };
          },
        };
      }
      if (table === "attachments") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: config.attachment ?? null, error: null }) }),
          }),
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
    storage: {
      from: () => ({
        createSignedUrl: () => Promise.resolve({ data: config.signedUrl ?? null, error: config.signError ?? null }),
      }),
    },
  };
  return { client: client as never, updateCalls };
}

const queuedTranscript = { id: "t1", owner_id: "owner-1", attachment_id: "a1", language: "pt", status: "queued" };
const attachment = { storage_path: "owner-1/item-1/a1.webm" };
const signedUrl = { signedUrl: "https://storage.example/signed" };

describe("transcribeAudio", () => {
  beforeEach(() => {
    enqueueJobMock.mockClear();
    submitMock.mockReset();
    getTranscriptionProviderMock.mockReset();
    getTranscriptionProviderMock.mockReturnValue({ name: "assemblyai", submit: submitMock });
  });

  it("caminho feliz: envia pro provedor, marca processing e enfileira o poll", async () => {
    submitMock.mockResolvedValue({ externalId: "ext-1" });
    const { client, updateCalls } = fakeSupabase({ transcript: queuedTranscript, attachment, signedUrl });

    const outcome = await transcribeAudio(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done" });
    expect(submitMock).toHaveBeenCalledWith({
      audioUrl: signedUrl.signedUrl,
      language: "pt",
      diarization: true,
      webhookUrl: "https://hub.example/api/webhooks/transcription",
    });
    expect(updateCalls[0]).toMatchObject({ external_id: "ext-1", status: "processing" });
    expect(enqueueJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "owner-1",
        kind: "poll_transcription",
        payload: { transcriptId: "11111111-1111-4111-8111-111111111111" },
        dedupeKey: "poll:11111111-1111-4111-8111-111111111111",
      }),
    );
  });

  it("transcript não encontrado: failed", async () => {
    const { client } = fakeSupabase({ transcript: null });
    const outcome = await transcribeAudio(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "failed" });
  });

  it("transcript já não está 'queued' (reprocessado): done sem chamar o provedor", async () => {
    const { client } = fakeSupabase({ transcript: { ...queuedTranscript, status: "processing" } });
    const outcome = await transcribeAudio(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done" });
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("anexo não encontrado: failed", async () => {
    const { client } = fakeSupabase({ transcript: queuedTranscript, attachment: null });
    const outcome = await transcribeAudio(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "failed" });
  });

  it("sem provedor configurado: failed", async () => {
    getTranscriptionProviderMock.mockReturnValue(null);
    const { client } = fakeSupabase({ transcript: queuedTranscript, attachment });
    const outcome = await transcribeAudio(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "failed" });
  });

  it("falha ao gerar a URL assinada: retry", async () => {
    const { client } = fakeSupabase({ transcript: queuedTranscript, attachment, signedUrl: null, signError: "boom" });
    const outcome = await transcribeAudio(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "retry" });
  });

  it("submit lança: retry (rede/API transitória)", async () => {
    submitMock.mockRejectedValue(new Error("timeout"));
    const { client } = fakeSupabase({ transcript: queuedTranscript, attachment, signedUrl });
    const outcome = await transcribeAudio(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "retry", error: "timeout" });
    expect(enqueueJobMock).not.toHaveBeenCalled();
  });

  it("payload inválido (sem transcriptId): failed", async () => {
    const { client } = fakeSupabase({ transcript: queuedTranscript, attachment, signedUrl });
    const outcome = await transcribeAudio(fakeJob({ payload: {} }), { supabase: client });
    expect(outcome).toMatchObject({ status: "failed" });
  });
});
