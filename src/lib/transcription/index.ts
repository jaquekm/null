import "server-only";
import { serverEnv } from "@/lib/env";
import { AssemblyAiProvider } from "./assemblyai";
import type { TranscriptionProvider } from "./types";

let cached: TranscriptionProvider | null | undefined;

/**
 * Seleciona o provedor por `TRANSCRIPTION_PROVIDER` (CLAUDE.md: "implementação
 * trocável por variável de ambiente"). Sem provedor/chave configurados
 * (ex.: ambiente local sem conta na AssemblyAI ainda) devolve `null` — quem
 * chama decide se isso é um erro (ex.: recusar a gravação) ou só desabilita
 * a funcionalidade.
 */
export function getTranscriptionProvider(): TranscriptionProvider | null {
  if (cached !== undefined) return cached;

  const providerName = serverEnv.TRANSCRIPTION_PROVIDER;
  const apiKey = serverEnv.TRANSCRIPTION_API_KEY;
  if (!providerName || !apiKey) {
    cached = null;
    return cached;
  }

  switch (providerName) {
    case "assemblyai":
      cached = new AssemblyAiProvider(apiKey, serverEnv.TRANSCRIPTION_WEBHOOK_SECRET);
      break;
    default:
      throw new Error(`Provedor de transcrição desconhecido em TRANSCRIPTION_PROVIDER: "${providerName}".`);
  }
  return cached;
}

export type { Segment, TranscriptionProvider, TranscriptionResult, TranscriptionSubmitInput } from "./types";
