import { describe, expect, it } from "vitest";
import { computeBoundingBox } from "./bounding-box";

describe("computeBoundingBox", () => {
  it("um nó só, com width/height explícitos", () => {
    const box = computeBoundingBox([{ x: 100, y: 100, width: 160, height: 80 }]);
    expect(box).toEqual({ x: 76, y: 76, width: 208, height: 128 });
  });

  it("um nó só, sem width/height salvo: usa o tamanho padrão de card", () => {
    const box = computeBoundingBox([{ x: 50, y: 50, width: null, height: null }]);
    expect(box).toEqual({ x: 26, y: 26, width: 208, height: 128 });
  });

  it("vários nós: envolve todos, do canto mais à esquerda/cima ao mais à direita/baixo", () => {
    const box = computeBoundingBox([
      { x: 0, y: 0, width: null, height: null },
      { x: 300, y: 200, width: null, height: null },
    ]);
    expect(box).toEqual({ x: -24, y: -24, width: 508, height: 328 });
  });

  it("nó com width/height próprios diferentes do padrão entra na conta certo", () => {
    const box = computeBoundingBox([
      { x: 0, y: 0, width: 40, height: 40 },
      { x: 500, y: 10, width: 300, height: 200 },
    ]);
    // borda direita: 500+300=800; borda inferior: max(0+40, 10+200)=210
    expect(box).toEqual({ x: -24, y: -24, width: 848, height: 258 });
  });

  it("lista vazia: lança", () => {
    expect(() => computeBoundingBox([])).toThrow();
  });
});
