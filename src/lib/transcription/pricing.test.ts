import { describe, expect, it } from "vitest";
import { estimateTranscriptionCostUsd } from "./pricing";

describe("estimateTranscriptionCostUsd", () => {
  it("calcula o custo proporcional às horas de áudio", () => {
    expect(estimateTranscriptionCostUsd("assemblyai", 3600)).toBeCloseTo(0.17, 6);
    expect(estimateTranscriptionCostUsd("assemblyai", 1800)).toBeCloseTo(0.085, 6);
  });

  it("devolve null pra provedor desconhecido", () => {
    expect(estimateTranscriptionCostUsd("outro-provedor", 3600)).toBeNull();
  });

  it("devolve null quando a duração não é conhecida", () => {
    expect(estimateTranscriptionCostUsd("assemblyai", null)).toBeNull();
  });
});
