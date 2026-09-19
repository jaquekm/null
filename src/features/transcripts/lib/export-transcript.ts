import type { Segment } from "@/lib/transcription/types";
import { formatTimestamp } from "./format-timestamp";
import { recomposeText } from "./recompose-text";

/** `HH:MM:SS,mmm`, o formato de timecode do SRT — diferente do `[HH:MM:SS]` da 2.7 (sem vírgula/milissegundos). */
function formatSrtTimestamp(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const wholeSeconds = Math.floor(clamped);
  const milliseconds = Math.round((clamped - wholeSeconds) * 1000);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const seconds = wholeSeconds % 60;
  const pad = (n: number, size = 2) => String(n).padStart(size, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
}

/** `.txt` (2.8): só o texto corrido, sem locutor/tempo. */
export function exportAsTxt(segments: Segment[]): string {
  return recomposeText(segments);
}

/** `.md` (2.8): "com locutores e tempos" — reaproveita o mesmo formato `[HH:MM:SS] Locutor: fala` da 2.7. */
export function exportAsMarkdown(segments: Segment[], speakerNames: Record<string, string>): string {
  return segments
    .map((segment) => {
      const name = speakerNames[segment.speaker] ?? segment.speaker;
      return `**${name}** \`[${formatTimestamp(segment.start)}]\`: ${segment.text}`;
    })
    .join("\n\n");
}

/** `.srt` (2.8): legenda padrão, um bloco numerado por segmento. */
export function exportAsSrt(segments: Segment[], speakerNames: Record<string, string>): string {
  return segments
    .map((segment, index) => {
      const name = speakerNames[segment.speaker] ?? segment.speaker;
      const start = formatSrtTimestamp(segment.start);
      const end = formatSrtTimestamp(segment.end);
      return `${index + 1}\n${start} --> ${end}\n${name}: ${segment.text}`;
    })
    .join("\n\n");
}
