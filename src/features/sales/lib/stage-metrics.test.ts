import { describe, expect, it } from "vitest";
import { computeAverageDurationDays, computeConversionFunnel } from "./stage-metrics";
import type { StageSegment } from "./stage-segments";

describe("computeConversionFunnel", () => {
  it("conta quantas oportunidades chegaram em cada etapa e a conversão pra próxima", () => {
    const itemA: StageSegment[] = [
      { stage: "lead", enteredAt: "t0", leftAt: "t1" },
      { stage: "qualificado", enteredAt: "t1", leftAt: "t2" },
      { stage: "proposta_enviada", enteredAt: "t2", leftAt: null },
    ];
    const itemB: StageSegment[] = [
      { stage: "lead", enteredAt: "t0", leftAt: "t1" },
      { stage: "qualificado", enteredAt: "t1", leftAt: null },
    ];
    const itemC: StageSegment[] = [{ stage: "lead", enteredAt: "t0", leftAt: null }];

    const funnel = computeConversionFunnel([itemA, itemB, itemC], ["lead", "qualificado", "proposta_enviada"]);

    expect(funnel).toEqual([
      { stage: "lead", reachedCount: 3, conversionToNextPercent: 66.7 },
      { stage: "qualificado", reachedCount: 2, conversionToNextPercent: 50 },
      { stage: "proposta_enviada", reachedCount: 1, conversionToNextPercent: null },
    ]);
  });

  it("etapa sem nenhuma oportunidade: conversão pra próxima é null, não divide por zero", () => {
    const funnel = computeConversionFunnel([], ["lead", "qualificado"]);
    expect(funnel).toEqual([
      { stage: "lead", reachedCount: 0, conversionToNextPercent: null },
      { stage: "qualificado", reachedCount: 0, conversionToNextPercent: null },
    ]);
  });

  it("ir e voltar pra mesma etapa conta só uma vez (chegou, não quantas vezes passou)", () => {
    const item: StageSegment[] = [
      { stage: "lead", enteredAt: "t0", leftAt: "t1" },
      { stage: "qualificado", enteredAt: "t1", leftAt: "t2" },
      { stage: "lead", enteredAt: "t2", leftAt: null },
    ];
    const funnel = computeConversionFunnel([item], ["lead", "qualificado"]);
    expect(funnel[0]).toEqual({ stage: "lead", reachedCount: 1, conversionToNextPercent: 100 });
  });
});

describe("computeAverageDurationDays", () => {
  it("segmento fechado conta a duração real; segmento aberto conta até `now`", () => {
    const now = new Date("2026-02-10T00:00:00Z");
    const itemA: StageSegment[] = [
      { stage: "lead", enteredAt: "2026-01-01T00:00:00Z", leftAt: "2026-01-04T00:00:00Z" },
      { stage: "qualificado", enteredAt: "2026-01-04T00:00:00Z", leftAt: null },
    ];
    const itemB: StageSegment[] = [{ stage: "lead", enteredAt: "2026-01-01T00:00:00Z", leftAt: "2026-01-06T00:00:00Z" }];

    const result = computeAverageDurationDays([itemA, itemB], now);

    expect(result).toEqual({ lead: 4, qualificado: 37 });
  });

  it("sem segmento nenhum daquela etapa: não aparece no resultado", () => {
    const result = computeAverageDurationDays([], new Date("2026-01-01T00:00:00Z"));
    expect(result).toEqual({});
  });
});
