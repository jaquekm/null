import { describe, expect, it } from "vitest";
import { computeAudioLevel } from "./audio-level";

describe("computeAudioLevel", () => {
  it("silêncio (tudo em 128) dá 0", () => {
    expect(computeAudioLevel(new Uint8Array([128, 128, 128, 128]))).toBe(0);
  });

  it("amplitude máxima (0/255 alternado) dá perto de 1", () => {
    const level = computeAudioLevel(new Uint8Array([0, 255, 0, 255]));
    expect(level).toBeGreaterThan(0.95);
    expect(level).toBeLessThanOrEqual(1.01);
  });

  it("array vazio dá 0 em vez de NaN", () => {
    expect(computeAudioLevel(new Uint8Array([]))).toBe(0);
  });

  it("nível intermediário fica entre 0 e 1", () => {
    const level = computeAudioLevel(new Uint8Array([100, 156, 100, 156]));
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThan(1);
  });
});
