import type { Segment } from "@/lib/transcription/types";

/**
 * Recompõe `transcripts.text` a partir dos `segments` (2.8: "corrigir texto
 * de um segmento edita `segments` e recompõe `text`"). Simples concatenação
 * com espaço, na ordem dos segmentos — o mesmo texto corrido que o provedor
 * devolve originalmente.
 */
export function recomposeText(segments: Segment[]): string {
  return segments.map((segment) => segment.text).join(" ");
}
