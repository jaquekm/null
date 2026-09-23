import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "./cosine-similarity";

describe("cosineSimilarity", () => {
  it("vetores iguais: 1", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("vetores ortogonais: 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("vetores opostos: -1", () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1);
  });

  it("vetor nulo: 0 (evita divisão por zero)", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});
