import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "./pricing";

describe("estimateCostUsd", () => {
  it("calcula o custo pelo preço por milhão de tokens do modelo", () => {
    // Sonnet 5: $2/MTok entrada, $10/MTok saída
    const cost = estimateCostUsd("claude-sonnet-5", { input_tokens: 500_000, output_tokens: 100_000 });
    expect(cost).toBeCloseTo(1 + 1, 6); // 500k*2/1e6 + 100k*10/1e6 = 1 + 1
  });

  it("zero tokens dá custo zero", () => {
    expect(estimateCostUsd("claude-sonnet-5", { input_tokens: 0, output_tokens: 0 })).toBe(0);
  });

  it("modelo desconhecido devolve null em vez de travar", () => {
    expect(estimateCostUsd("um-modelo-que-nao-existe", { input_tokens: 100, output_tokens: 100 })).toBeNull();
  });
});
