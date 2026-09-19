/** Um trecho da transcrição, com locutor e marcação de tempo (usado no resumo — 2.7 — e no visualizador — 2.8). */
export interface Segment {
  speaker: string;
  /** Início e fim em segundos, relativos ao começo do áudio. */
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionSubmitInput {
  /** URL assinada do Storage, válida só pelo tempo do processamento. */
  audioUrl: string;
  /** Código de idioma no formato do provedor escolhido (ex.: 'pt'). */
  language: string;
  diarization: boolean;
  webhookUrl: string;
}

export type TranscriptionResult =
  | { status: "processing" }
  | { status: "failed"; error: string }
  | { status: "completed"; text: string; segments: Segment[]; durationSeconds: number };

/**
 * Provedor de transcrição atrás de interface (CLAUDE.md: "provedores
 * externos ficam atrás de uma interface, com implementação trocável por
 * variável de ambiente"). Implementação escolhida: AssemblyAI (`assemblyai.ts`,
 * decisão registrada em `docs/decisoes.md`).
 */
export interface TranscriptionProvider {
  name: string;
  submit(input: TranscriptionSubmitInput): Promise<{ externalId: string }>;
  fetchResult(externalId: string): Promise<TranscriptionResult>;
  /** Confirma que a chamada veio do provedor e devolve o `externalId` do recurso. Inválido → `null`. */
  verifyWebhook(req: Request): Promise<{ externalId: string } | null>;
}
