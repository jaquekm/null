import { describe, expect, it } from "vitest";
import { averageEmbedding } from "./embeddings-math";

describe("averageEmbedding", () => {
  it("sem vetores: null", () => {
    expect(averageEmbedding([])).toBeNull();
  });

  it("um único vetor: devolve ele mesmo", () => {
    expect(averageEmbedding([[1, 2, 3]])).toEqual([1, 2, 3]);
  });

  it("média elemento a elemento de vários vetores", () => {
    expect(averageEmbedding([[1, 2, 3], [3, 4, 5]])).toEqual([2, 3, 4]);
  });

  it("três vetores", () => {
    expect(averageEmbedding([[0, 0], [3, 0], [0, 3]])).toEqual([1, 1]);
  });
});
