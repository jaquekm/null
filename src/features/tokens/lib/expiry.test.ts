import { describe, expect, it } from "vitest";
import { computeExpiresAt } from "./expiry";

const DAY_MS = 86_400_000;

describe("computeExpiresAt", () => {
  it("retorna null para validade 'never'", () => {
    expect(computeExpiresAt("never")).toBeNull();
  });

  it.each([
    ["30", 30],
    ["90", 90],
    ["365", 365],
  ] as const)("expira %s dias após a data base", (validity, days) => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const result = computeExpiresAt(validity, now);
    expect(result).not.toBeNull();
    expect((new Date(result!).getTime() - now.getTime()) / DAY_MS).toBe(days);
  });
});
