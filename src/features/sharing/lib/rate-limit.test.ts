import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("permite até maxAttempts tentativas na janela", () => {
    const check = createRateLimiter(3, 60_000);
    const now = 1_000_000;
    expect(check("ip-1", now)).toBe(false);
    expect(check("ip-1", now + 1)).toBe(false);
    expect(check("ip-1", now + 2)).toBe(false);
  });

  it("a tentativa seguinte à maxAttempts-ésima é bloqueada", () => {
    const check = createRateLimiter(3, 60_000);
    const now = 1_000_000;
    check("ip-1", now);
    check("ip-1", now + 1);
    check("ip-1", now + 2);
    expect(check("ip-1", now + 3)).toBe(true);
  });

  it("chaves diferentes têm contadores independentes", () => {
    const check = createRateLimiter(1, 60_000);
    const now = 1_000_000;
    expect(check("ip-1", now)).toBe(false);
    expect(check("ip-2", now)).toBe(false);
  });

  it("fora da janela: o contador reseta", () => {
    const check = createRateLimiter(1, 60_000);
    const now = 1_000_000;
    check("ip-1", now);
    expect(check("ip-1", now + 60_000 + 1)).toBe(false);
  });
});
