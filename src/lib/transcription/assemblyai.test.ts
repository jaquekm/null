import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssemblyAiProvider } from "./assemblyai";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body) };
}

describe("AssemblyAiProvider.submit", () => {
  it("envia audio_url, language_code e webhook_url, e devolve o id como externalId", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "trans-1" }));
    const provider = new AssemblyAiProvider("api-key", "webhook-secret");

    const result = await provider.submit({
      audioUrl: "https://storage.example/a.webm",
      language: "pt",
      diarization: true,
      webhookUrl: "https://hub.example/api/webhooks/transcription",
    });

    expect(result).toEqual({ externalId: "trans-1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.assemblyai.com/v2/transcript");
    expect(init.headers).toMatchObject({ authorization: "api-key" });
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      audio_url: "https://storage.example/a.webm",
      language_code: "pt",
      speaker_labels: true,
      webhook_url: "https://hub.example/api/webhooks/transcription",
      webhook_auth_header_name: "x-hub-transcription-secret",
      webhook_auth_header_value: "webhook-secret",
    });
  });

  it("não inclui header de webhook quando não há segredo configurado", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "trans-1" }));
    const provider = new AssemblyAiProvider("api-key", undefined);

    await provider.submit({ audioUrl: "u", language: "pt", diarization: false, webhookUrl: "w" });

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.webhook_auth_header_name).toBeUndefined();
  });

  it("lança erro quando a API responde com falha", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "áudio inválido" }, false, 400));
    const provider = new AssemblyAiProvider("api-key", undefined);

    await expect(
      provider.submit({ audioUrl: "u", language: "pt", diarization: false, webhookUrl: "w" }),
    ).rejects.toThrow(/áudio inválido/);
  });
});

describe("AssemblyAiProvider.fetchResult", () => {
  const provider = new AssemblyAiProvider("api-key", undefined);

  it("processing enquanto status é queued ou processing", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "queued" }));
    await expect(provider.fetchResult("id-1")).resolves.toEqual({ status: "processing" });

    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "processing" }));
    await expect(provider.fetchResult("id-1")).resolves.toEqual({ status: "processing" });
  });

  it("failed com a mensagem de erro do provedor", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "error", error: "arquivo corrompido" }));
    await expect(provider.fetchResult("id-1")).resolves.toEqual({ status: "failed", error: "arquivo corrompido" });
  });

  it("completed converte utterances (ms) em segments (segundos)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: "completed",
        text: "Olá mundo",
        audio_duration: 12,
        utterances: [
          { speaker: "A", text: "Olá", start: 0, end: 1500 },
          { speaker: "B", text: "mundo", start: 1500, end: 3000 },
        ],
      }),
    );

    const result = await provider.fetchResult("id-1");
    expect(result).toEqual({
      status: "completed",
      text: "Olá mundo",
      durationSeconds: 12,
      segments: [
        { speaker: "A", start: 0, end: 1.5, text: "Olá" },
        { speaker: "B", start: 1.5, end: 3, text: "mundo" },
      ],
    });
  });

  it("completed sem diarização vira um único segment cobrindo o áudio", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: "completed", text: "Olá mundo", audio_duration: 5, utterances: null }),
    );

    const result = await provider.fetchResult("id-1");
    expect(result).toEqual({
      status: "completed",
      text: "Olá mundo",
      durationSeconds: 5,
      segments: [{ speaker: "desconhecido", start: 0, end: 5, text: "Olá mundo" }],
    });
  });

  it("lança erro em HTTP não-ok", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 500));
    await expect(provider.fetchResult("id-1")).rejects.toThrow(/HTTP 500/);
  });
});

describe("AssemblyAiProvider.verifyWebhook", () => {
  it("aceita quando o header do segredo confere e devolve o externalId", async () => {
    const provider = new AssemblyAiProvider("api-key", "webhook-secret");
    const req = new Request("https://hub.example/api/webhooks/transcription", {
      method: "POST",
      headers: { "x-hub-transcription-secret": "webhook-secret" },
      body: JSON.stringify({ transcript_id: "trans-1", status: "completed" }),
    });

    await expect(provider.verifyWebhook(req)).resolves.toEqual({ externalId: "trans-1" });
  });

  it("rejeita quando o header do segredo não confere", async () => {
    const provider = new AssemblyAiProvider("api-key", "webhook-secret");
    const req = new Request("https://hub.example/api/webhooks/transcription", {
      method: "POST",
      headers: { "x-hub-transcription-secret": "errado" },
      body: JSON.stringify({ transcript_id: "trans-1" }),
    });

    await expect(provider.verifyWebhook(req)).resolves.toBeNull();
  });

  it("rejeita quando falta o header e há segredo configurado", async () => {
    const provider = new AssemblyAiProvider("api-key", "webhook-secret");
    const req = new Request("https://hub.example/api/webhooks/transcription", {
      method: "POST",
      body: JSON.stringify({ transcript_id: "trans-1" }),
    });

    await expect(provider.verifyWebhook(req)).resolves.toBeNull();
  });

  it("sem segredo configurado, aceita qualquer chamada com transcript_id válido", async () => {
    const provider = new AssemblyAiProvider("api-key", undefined);
    const req = new Request("https://hub.example/api/webhooks/transcription", {
      method: "POST",
      body: JSON.stringify({ transcript_id: "trans-1" }),
    });

    await expect(provider.verifyWebhook(req)).resolves.toEqual({ externalId: "trans-1" });
  });
});
