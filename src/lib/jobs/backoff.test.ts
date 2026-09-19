import { describe, expect, it } from "vitest";
import { computeBackoffSeconds } from "./backoff";

describe("computeBackoffSeconds", () => {
  it("dobra a cada tentativa: 2^attempts minutos", () => {
    expect(computeBackoffSeconds(0)).toBe(1 * 60);
    expect(computeBackoffSeconds(1)).toBe(2 * 60);
    expect(computeBackoffSeconds(2)).toBe(4 * 60);
    expect(computeBackoffSeconds(3)).toBe(8 * 60);
  });

  it("nunca passa de 60 minutos", () => {
    expect(computeBackoffSeconds(6)).toBe(60 * 60);
    expect(computeBackoffSeconds(10)).toBe(60 * 60);
    expect(computeBackoffSeconds(100)).toBe(60 * 60);
  });
});
