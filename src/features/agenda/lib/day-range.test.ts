import { describe, expect, it } from "vitest";
import { computeDayRange } from "./day-range";

describe("computeDayRange", () => {
  it("início e fim do dia em America/Sao_Paulo (UTC-3), convertidos pra UTC", () => {
    // 2026-01-15 14:00 UTC = 2026-01-15 11:00 em São Paulo, mesmo dia local
    const range = computeDayRange(new Date("2026-01-15T14:00:00.000Z"), "America/Sao_Paulo");
    expect(range.dateStr).toBe("2026-01-15");
    expect(range.startIso).toBe("2026-01-15T03:00:00.000Z"); // 00:00 local = 03:00 UTC
    expect(range.endIsoExclusive).toBe("2026-01-16T03:00:00.000Z");
  });

  it("perto da meia-noite local: cai no dia local certo, não no dia UTC", () => {
    // 2026-01-15 02:00 UTC = 2026-01-14 23:00 em São Paulo — ainda dia 14 local
    const range = computeDayRange(new Date("2026-01-15T02:00:00.000Z"), "America/Sao_Paulo");
    expect(range.dateStr).toBe("2026-01-14");
  });

  it("intervalo de exatas 24h", () => {
    const range = computeDayRange(new Date("2026-06-01T12:00:00.000Z"), "America/Sao_Paulo");
    const diffMs = new Date(range.endIsoExclusive).getTime() - new Date(range.startIso).getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000);
  });
});
