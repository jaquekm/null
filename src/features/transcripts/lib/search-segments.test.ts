import { describe, expect, it } from "vitest";
import { findMatchingSegments } from "./search-segments";

const segments = [
  { speaker: "A", start: 0, end: 1, text: "Vamos falar do Roadmap." },
  { speaker: "B", start: 1, end: 2, text: "Ótimo, sem problema." },
  { speaker: "A", start: 2, end: 3, text: "O ROADMAP está atrasado." },
];

describe("findMatchingSegments", () => {
  it("encontra ocorrências sem diferenciar maiúsculas/minúsculas", () => {
    expect(findMatchingSegments(segments, "roadmap")).toEqual([0, 2]);
  });

  it("busca vazia não dá nenhum resultado", () => {
    expect(findMatchingSegments(segments, "")).toEqual([]);
    expect(findMatchingSegments(segments, "   ")).toEqual([]);
  });

  it("sem ocorrências dá lista vazia", () => {
    expect(findMatchingSegments(segments, "orçamento")).toEqual([]);
  });
});
