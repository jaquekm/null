/**
 * Paleta fixa, cor por locutor (2.8: "lista de segmentos com locutor — cor
 * por locutor"). Cicla pela ordem de primeira aparição do locutor nos
 * segmentos, não pelo rótulo cru do provedor ("A"/"B"/...) — assim a cor
 * fica estável mesmo se o provedor mudar a ordem das letras entre reruns.
 */
const SPEAKER_COLOR_CLASSES = [
  "text-blue-700 dark:text-blue-400",
  "text-emerald-700 dark:text-emerald-400",
  "text-amber-700 dark:text-amber-400",
  "text-purple-700 dark:text-purple-400",
  "text-rose-700 dark:text-rose-400",
  "text-cyan-700 dark:text-cyan-400",
  "text-orange-700 dark:text-orange-400",
  "text-teal-700 dark:text-teal-400",
];

/** Ordem estável de locutores, pela primeira vez que cada um aparece nos segmentos. */
export function orderSpeakers(speakers: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const speaker of speakers) {
    if (!seen.has(speaker)) {
      seen.add(speaker);
      ordered.push(speaker);
    }
  }
  return ordered;
}

export function colorForSpeaker(speaker: string, orderedSpeakers: string[]): string {
  const index = orderedSpeakers.indexOf(speaker);
  if (index === -1) return SPEAKER_COLOR_CLASSES[0]!;
  return SPEAKER_COLOR_CLASSES[index % SPEAKER_COLOR_CLASSES.length]!;
}
