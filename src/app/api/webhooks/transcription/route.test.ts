import { beforeEach, describe, expect, it, vi } from "vitest";

const getTranscriptionProviderMock = vi.fn();
vi.mock("@/lib/transcription", () => ({ getTranscriptionProvider: getTranscriptionProviderMock }));

const applyTranscriptionResultMock = vi.fn().mockResolvedValue("completed");
vi.mock("@/features/transcripts/lib/apply-result", () => ({ applyTranscriptionResult: applyTranscriptionResultMock }));

let transcriptRow: Record<string, unknown> | null = null;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: transcriptRow, error: null }) }) }),
      }),
    }),
  }),
}));

const { POST } = await import("./route");

function fakeRequest(): Request {
  return new Request("https://hub.example/api/webhooks/transcription", {
    method: "POST",
    body: JSON.stringify({ transcript_id: "ext-1", status: "completed" }),
  });
}

describe("POST /api/webhooks/transcription", () => {
  beforeEach(() => {
    getTranscriptionProviderMock.mockReset();
    applyTranscriptionResultMock.mockClear();
    transcriptRow = null;
  });

  it("sem provedor configurado: 401", async () => {
    getTranscriptionProviderMock.mockReturnValue(null);
    const res = await POST(fakeRequest());
    expect(res.status).toBe(401);
  });

  it("verifyWebhook inválido: 401", async () => {
    getTranscriptionProviderMock.mockReturnValue({
      name: "assemblyai",
      verifyWebhook: vi.fn().mockResolvedValue(null),
    });
    const res = await POST(fakeRequest());
    expect(res.status).toBe(401);
  });

  it("transcript desconhecido (provider+external_id sem match): 200, idempotente, não chama fetchResult", async () => {
    const fetchResult = vi.fn();
    getTranscriptionProviderMock.mockReturnValue({
      name: "assemblyai",
      verifyWebhook: vi.fn().mockResolvedValue({ externalId: "ext-1" }),
      fetchResult,
    });
    transcriptRow = null;

    const res = await POST(fakeRequest());

    expect(res.status).toBe(200);
    expect(fetchResult).not.toHaveBeenCalled();
    expect(applyTranscriptionResultMock).not.toHaveBeenCalled();
  });

  it("transcript já não está 'processing' (webhook repetido): 200, idempotente", async () => {
    const fetchResult = vi.fn();
    getTranscriptionProviderMock.mockReturnValue({
      name: "assemblyai",
      verifyWebhook: vi.fn().mockResolvedValue({ externalId: "ext-1" }),
      fetchResult,
    });
    transcriptRow = { id: "t1", owner_id: "owner-1", item_id: "item-1", provider: "assemblyai", summarize: false, status: "completed" };

    const res = await POST(fakeRequest());

    expect(res.status).toBe(200);
    expect(fetchResult).not.toHaveBeenCalled();
    expect(applyTranscriptionResultMock).not.toHaveBeenCalled();
  });

  it("caminho feliz: busca o resultado de verdade (não confia no payload) e aplica", async () => {
    const fetchResult = vi.fn().mockResolvedValue({ status: "completed", text: "x", segments: [], durationSeconds: 5 });
    getTranscriptionProviderMock.mockReturnValue({
      name: "assemblyai",
      verifyWebhook: vi.fn().mockResolvedValue({ externalId: "ext-1" }),
      fetchResult,
    });
    transcriptRow = { id: "t1", owner_id: "owner-1", item_id: "item-1", provider: "assemblyai", summarize: false, status: "processing" };

    const res = await POST(fakeRequest());

    expect(res.status).toBe(200);
    expect(fetchResult).toHaveBeenCalledWith("ext-1");
    expect(applyTranscriptionResultMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "t1", ownerId: "owner-1", itemId: "item-1" }),
      { status: "completed", text: "x", segments: [], durationSeconds: 5 },
    );
  });
});
