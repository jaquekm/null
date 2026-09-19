import { describe, expect, it } from "vitest";
import { colorForSpeaker, orderSpeakers } from "./speaker-color";

describe("orderSpeakers", () => {
  it("ordena pela primeira aparição, sem repetir", () => {
    expect(orderSpeakers(["B", "A", "B", "C", "A"])).toEqual(["B", "A", "C"]);
  });

  it("lista vazia dá lista vazia", () => {
    expect(orderSpeakers([])).toEqual([]);
  });
});

describe("colorForSpeaker", () => {
  it("dá cores diferentes pra locutores diferentes", () => {
    const ordered = orderSpeakers(["A", "B", "C"]);
    const colorA = colorForSpeaker("A", ordered);
    const colorB = colorForSpeaker("B", ordered);
    expect(colorA).not.toBe(colorB);
  });

  it("a mesma cor sempre pro mesmo locutor", () => {
    const ordered = orderSpeakers(["A", "B"]);
    expect(colorForSpeaker("A", ordered)).toBe(colorForSpeaker("A", ordered));
  });

  it("locutor desconhecido (fora da lista ordenada) não quebra, cai na primeira cor", () => {
    expect(colorForSpeaker("Z", ["A", "B"])).toBe(colorForSpeaker("A", ["A", "B"]));
  });
});
