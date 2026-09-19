/**
 * Preço por hora de transcrição, por provedor (2.6: "registrar usage_events").
 * Só o provedor ativo tem preço aqui por enquanto (2.4: AssemblyAI, decisão
 * e fonte em `docs/decisoes.md`) — um provedor futuro soma uma entrada nova.
 * Conferir a página oficial de preços se o custo real observado em
 * `usage_events` destoar muito disso.
 */
const PRICE_PER_HOUR_USD: Record<string, number> = {
  // Universal-2 (US$0,15/h) + diarização (US$0,02/h), preço em 2026-09-19.
  assemblyai: 0.17,
};

/** `null` quando o provedor ou a duração não são conhecidos — registra o uso sem travar por causa do custo. */
export function estimateTranscriptionCostUsd(provider: string, durationSeconds: number | null): number | null {
  const perHour = PRICE_PER_HOUR_USD[provider];
  if (perHour === undefined || durationSeconds === null) return null;
  return (durationSeconds / 3600) * perHour;
}
