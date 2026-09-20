import { describe, expect, it } from "vitest";
import { computeShareExpiresAt } from "./compute-expires-at";

const now = new Date("2026-01-01T12:00:00.000Z");

describe("computeShareExpiresAt", () => {
  it("1d", () => {
    expect(computeShareExpiresAt("1d", now)).toBe("2026-01-02T12:00:00.000Z");
  });

  it("7d", () => {
    expect(computeShareExpiresAt("7d", now)).toBe("2026-01-08T12:00:00.000Z");
  });

  it("30d (padrão)", () => {
    expect(computeShareExpiresAt("30d", now)).toBe("2026-01-31T12:00:00.000Z");
  });

  it("90d", () => {
    expect(computeShareExpiresAt("90d", now)).toBe("2026-04-01T12:00:00.000Z");
  });

  it("none: null (sem validade)", () => {
    expect(computeShareExpiresAt("none", now)).toBeNull();
  });
});
