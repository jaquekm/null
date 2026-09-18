import { describe, expect, it } from "vitest";
import { positionBetween } from "./position";

describe("positionBetween", () => {
  it("retorna 0 quando a lista está vazia", () => {
    expect(positionBetween(null, null)).toBe(0);
  });

  it("retorna a média entre os dois vizinhos", () => {
    expect(positionBetween(1, 3)).toBe(2);
    expect(positionBetween(0, 1)).toBe(0.5);
  });

  it("retorna vizinho + 1 quando solto no fim da lista", () => {
    expect(positionBetween(5, null)).toBe(6);
  });

  it("retorna vizinho - 1 quando solto no início da lista", () => {
    expect(positionBetween(null, 5)).toBe(4);
  });
});
