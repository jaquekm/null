import { describe, expect, it } from "vitest";
import { computeStreak } from "./streak";

describe("computeStreak", () => {
  it("zero sem nenhum dia ativo", () => {
    expect(computeStreak([], "2026-09-22")).toBe(0);
  });

  it("conta dias consecutivos terminando hoje", () => {
    expect(computeStreak(["2026-09-20", "2026-09-21", "2026-09-22"], "2026-09-22")).toBe(3);
  });

  it("para na primeira lacuna", () => {
    expect(computeStreak(["2026-09-18", "2026-09-21", "2026-09-22"], "2026-09-22")).toBe(2);
  });

  it("hoje sem sessão ainda: conta a partir de ontem, não zera", () => {
    expect(computeStreak(["2026-09-20", "2026-09-21"], "2026-09-22")).toBe(2);
  });

  it("nem hoje nem ontem: sequência zerada", () => {
    expect(computeStreak(["2026-09-18"], "2026-09-22")).toBe(0);
  });
});
