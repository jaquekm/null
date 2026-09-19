import { describe, expect, it } from "vitest";
import { timingSafeEqualStrings } from "./timing-safe-equal";

describe("timingSafeEqualStrings", () => {
  it("true para valores idênticos", () => {
    expect(timingSafeEqualStrings("segredo-123", "segredo-123")).toBe(true);
  });

  it("false para valores diferentes do mesmo tamanho", () => {
    expect(timingSafeEqualStrings("segredo-123", "segredo-456")).toBe(false);
  });

  it("false para tamanhos diferentes, sem lançar", () => {
    expect(timingSafeEqualStrings("curto", "um-valor-bem-mais-longo")).toBe(false);
  });

  it("true pra duas strings vazias", () => {
    expect(timingSafeEqualStrings("", "")).toBe(true);
  });
});
