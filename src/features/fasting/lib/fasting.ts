/** Minutos entre `startedAt` e `now`, nunca negativo (relógio do cliente pode atrasar um tico em relação ao servidor). */
export function elapsedMinutes(startedAt: string, now: Date): number {
  const minutes = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 60_000);
  return Math.max(0, minutes);
}

/** "16h 32min" / "45min" / "0min" — mesma forma de `formatFocusDuration` (10.3), cada feature com a sua (não dá pra compartilhar sem acoplar jejum a foco). */
export function formatFastingDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}min`;
}

/** Média de duração (minutos) de uma lista de jejuns — `null` sem nenhum ainda, pra tela mostrar "sem dados" em vez de "0min". */
export function averageDurationMinutes(durationsMinutes: number[]): number | null {
  if (durationsMinutes.length === 0) return null;
  const total = durationsMinutes.reduce((sum, value) => sum + value, 0);
  return Math.round(total / durationsMinutes.length);
}
