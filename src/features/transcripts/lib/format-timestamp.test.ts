import { describe, expect, it } from "vitest";
import { formatTimestamp } from "./format-timestamp";

describe("formatTimestamp", () => {
  it("formata horas, minutos e segundos com zero à esquerda", () => {
    expect(formatTimestamp(192)).toBe("00:03:12"); // 3min12s, do exemplo do enunciado
    expect(formatTimestamp(0)).toBe("00:00:00");
    expect(formatTimestamp(3661)).toBe("01:01:01");
  });

  it("trunca frações de segundo", () => {
    expect(formatTimestamp(12.9)).toBe("00:00:12");
  });

  it("nunca fica negativo", () => {
    expect(formatTimestamp(-5)).toBe("00:00:00");
  });
});
