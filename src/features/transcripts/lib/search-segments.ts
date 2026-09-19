import type { Segment } from "@/lib/transcription/types";

/** Índices dos segmentos cujo texto contém a busca, sem diferenciar maiúsculas/minúsculas (2.8: "busca dentro da transcrição"). */
export function findMatchingSegments(segments: Segment[], query: string): number[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const matches: number[] = [];
  segments.forEach((segment, index) => {
    if (segment.text.toLowerCase().includes(trimmed)) matches.push(index);
  });
  return matches;
}
