import { describe, expect, it } from "vitest";
import { buildStageSegments } from "./stage-segments";

describe("buildStageSegments", () => {
  it("sem versão nenhuma: um segmento só, aberto, desde a criação do item", () => {
    const segments = buildStageSegments("t0", [], { stage: "lead" });
    expect(segments).toEqual([{ stage: "lead", enteredAt: "t0", leftAt: null }]);
  });

  it("uma versão: dois segmentos, o primeiro fechado no instante da versão", () => {
    const segments = buildStageSegments("t0", [{ stage: "lead", until: "t1" }], { stage: "qualificado" });
    expect(segments).toEqual([
      { stage: "lead", enteredAt: "t0", leftAt: "t1" },
      { stage: "qualificado", enteredAt: "t1", leftAt: null },
    ]);
  });

  it("duas versões seguidas com o mesmo stage (outra propriedade mudou): funde num segmento só", () => {
    const segments = buildStageSegments(
      "t0",
      [
        { stage: "lead", until: "t1" },
        { stage: "lead", until: "t2" },
      ],
      { stage: "qualificado" },
    );
    expect(segments).toEqual([
      { stage: "lead", enteredAt: "t0", leftAt: "t2" },
      { stage: "qualificado", enteredAt: "t2", leftAt: null },
    ]);
  });

  it("stage nulo num trecho (propriedade ainda não preenchida): ignora esse trecho", () => {
    const segments = buildStageSegments("t0", [{ stage: null, until: "t1" }], { stage: "lead" });
    expect(segments).toEqual([{ stage: "lead", enteredAt: "t1", leftAt: null }]);
  });

  it("vai e volta pro mesmo stage (não adjacente): não funde, fica como dois segmentos separados", () => {
    const segments = buildStageSegments(
      "t0",
      [
        { stage: "lead", until: "t1" },
        { stage: "qualificado", until: "t2" },
      ],
      { stage: "lead" },
    );
    expect(segments).toEqual([
      { stage: "lead", enteredAt: "t0", leftAt: "t1" },
      { stage: "qualificado", enteredAt: "t1", leftAt: "t2" },
      { stage: "lead", enteredAt: "t2", leftAt: null },
    ]);
  });

  it("estado atual com stage nulo: só os segmentos anteriores aparecem, sem segmento aberto", () => {
    const segments = buildStageSegments("t0", [{ stage: "lead", until: "t1" }], { stage: null });
    expect(segments).toEqual([{ stage: "lead", enteredAt: "t0", leftAt: "t1" }]);
  });
});
