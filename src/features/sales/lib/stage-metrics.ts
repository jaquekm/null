import type { StageSegment } from "./stage-segments";

export interface ConversionStep {
  stage: string;
  reachedCount: number;
  /** `null` no último degrau do funil (não tem "próxima etapa" pra comparar). */
  conversionToNextPercent: number | null;
}

/**
 * Funil de conversão (5.6, painel `/vendas`): quantas oportunidades
 * distintas já passaram por cada etapa (ao menos um segmento) e que fração
 * também chegou na próxima. `stageOrder` é a ordem das etapas de
 * *progresso* do funil — não inclui desfechos como "ganho"/"perdido", que
 * são resultado, não um degrau intermediário a comparar com o seguinte.
 */
export function computeConversionFunnel(segmentsByItem: StageSegment[][], stageOrder: string[]): ConversionStep[] {
  const reachedCount = new Map<string, number>();
  for (const stage of stageOrder) reachedCount.set(stage, 0);

  for (const segments of segmentsByItem) {
    const visited = new Set(segments.map((s) => s.stage));
    for (const stage of stageOrder) {
      if (visited.has(stage)) reachedCount.set(stage, (reachedCount.get(stage) ?? 0) + 1);
    }
  }

  return stageOrder.map((stage, index) => {
    const count = reachedCount.get(stage) ?? 0;
    const nextStage = stageOrder[index + 1];
    const nextCount = nextStage ? (reachedCount.get(nextStage) ?? 0) : null;
    return {
      stage,
      reachedCount: count,
      conversionToNextPercent: nextCount === null || count === 0 ? null : Math.round((nextCount / count) * 1000) / 10,
    };
  });
}

/** Tempo médio (em dias, 1 casa decimal) passado em cada etapa — segmentos abertos contam até `now`. */
export function computeAverageDurationDays(segmentsByItem: StageSegment[][], now: Date): Record<string, number> {
  const totalMs = new Map<string, number>();
  const count = new Map<string, number>();

  for (const segments of segmentsByItem) {
    for (const segment of segments) {
      const start = new Date(segment.enteredAt).getTime();
      const end = segment.leftAt ? new Date(segment.leftAt).getTime() : now.getTime();
      const duration = Math.max(0, end - start);
      totalMs.set(segment.stage, (totalMs.get(segment.stage) ?? 0) + duration);
      count.set(segment.stage, (count.get(segment.stage) ?? 0) + 1);
    }
  }

  const result: Record<string, number> = {};
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  for (const [stage, ms] of totalMs) {
    const n = count.get(stage) ?? 1;
    result[stage] = Math.round((ms / n / MS_PER_DAY) * 10) / 10;
  }
  return result;
}
