import type { Segment } from "@/lib/transcription/types";
import { formatTimestamp } from "./format-timestamp";

/**
 * Monta o texto com locutores e marcações de tempo (2.7), aplicando
 * `speaker_names` quando existirem — é o texto que alimenta o prompt de
 * resumo. Formato do enunciado: `[00:03:12] João: ...`.
 */
export function buildTranscriptText(segments: Segment[], speakerNames: Record<string, string>): string {
  return segments
    .map((segment) => {
      const name = speakerNames[segment.speaker] ?? segment.speaker;
      return `[${formatTimestamp(segment.start)}] ${name}: ${segment.text}`;
    })
    .join("\n");
}
