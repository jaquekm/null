import { timingSafeEqualStrings } from "@/lib/timing-safe-equal";
import type { Segment, TranscriptionProvider, TranscriptionResult, TranscriptionSubmitInput } from "./types";

const API_BASE = "https://api.assemblyai.com/v2";

/** Header custom devolvido pela AssemblyAI em toda chamada de webhook — é como `verifyWebhook` confirma a origem (a AssemblyAI não assina o corpo). */
const WEBHOOK_SECRET_HEADER = "x-hub-transcription-secret";

interface AssemblyAiSubmitResponse {
  id: string;
  error?: string;
}

interface AssemblyAiUtterance {
  speaker: string;
  text: string;
  start: number; // ms
  end: number; // ms
}

interface AssemblyAiTranscriptResponse {
  status: "queued" | "processing" | "completed" | "error";
  text: string | null;
  error: string | null;
  audio_duration: number | null; // segundos
  utterances: AssemblyAiUtterance[] | null;
}

interface AssemblyAiWebhookPayload {
  transcript_id: string;
}

/**
 * Provedor de transcrição via AssemblyAI (decisão registrada em
 * `docs/decisoes.md`, tarefa 2.4). API: `POST /v2/transcript` recebe a URL
 * do áudio e um `webhook_url`; `GET /v2/transcript/{id}` devolve o
 * resultado. Autenticação: header `authorization` com a chave crua (sem
 * "Bearer").
 */
export class AssemblyAiProvider implements TranscriptionProvider {
  readonly name = "assemblyai";

  constructor(
    private readonly apiKey: string,
    private readonly webhookSecret: string | undefined,
  ) {}

  async submit(input: TranscriptionSubmitInput): Promise<{ externalId: string }> {
    const body: Record<string, unknown> = {
      audio_url: input.audioUrl,
      language_code: input.language,
      speaker_labels: input.diarization,
      webhook_url: input.webhookUrl,
    };
    if (this.webhookSecret) {
      body.webhook_auth_header_name = WEBHOOK_SECRET_HEADER;
      body.webhook_auth_header_value = this.webhookSecret;
    }

    const res = await fetch(`${API_BASE}/transcript`, {
      method: "POST",
      headers: { authorization: this.apiKey, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as AssemblyAiSubmitResponse;
    if (!res.ok || !data.id) {
      throw new Error(`AssemblyAI: falha ao enviar áudio para transcrição (${data.error ?? res.statusText}).`);
    }
    return { externalId: data.id };
  }

  async fetchResult(externalId: string): Promise<TranscriptionResult> {
    const res = await fetch(`${API_BASE}/transcript/${externalId}`, {
      headers: { authorization: this.apiKey },
    });
    if (!res.ok) {
      throw new Error(`AssemblyAI: falha ao consultar transcrição ${externalId} (HTTP ${res.status}).`);
    }
    const data = (await res.json()) as AssemblyAiTranscriptResponse;

    if (data.status === "queued" || data.status === "processing") {
      return { status: "processing" };
    }
    if (data.status === "error") {
      return { status: "failed", error: data.error ?? "Erro desconhecido na AssemblyAI." };
    }

    const durationSeconds = data.audio_duration ?? 0;
    const segments: Segment[] = data.utterances?.length
      ? data.utterances.map((u) => ({
          speaker: u.speaker,
          start: u.start / 1000,
          end: u.end / 1000,
          text: u.text,
        }))
      : [{ speaker: "desconhecido", start: 0, end: durationSeconds, text: data.text ?? "" }];

    return { status: "completed", text: data.text ?? "", segments, durationSeconds };
  }

  async verifyWebhook(req: Request): Promise<{ externalId: string } | null> {
    if (this.webhookSecret) {
      const received = req.headers.get(WEBHOOK_SECRET_HEADER) ?? "";
      if (!timingSafeEqualStrings(received, this.webhookSecret)) return null;
    }
    try {
      const payload = (await req.json()) as AssemblyAiWebhookPayload;
      if (!payload.transcript_id) return null;
      return { externalId: payload.transcript_id };
    } catch {
      return null;
    }
  }
}
