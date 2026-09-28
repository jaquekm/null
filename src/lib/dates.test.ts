import { describe, expect, it } from "vitest";
import { addDaysToDateString, dateInTimezone, todayInTimezone } from "./dates";

describe("todayInTimezone", () => {
  it("22h em Brasília ainda é o mesmo dia (em UTC já seria amanhã)", () => {
    const at22hBrasilia = new Date("2026-09-29T01:00:00Z");
    expect(at22hBrasilia.toISOString().slice(0, 10)).toBe("2026-09-29");
    expect(todayInTimezone("America/Sao_Paulo", at22hBrasilia)).toBe("2026-09-28");
  });

  it("usa America/Sao_Paulo por padrão", () => {
    expect(dateInTimezone(new Date("2026-01-01T02:30:00Z"))).toBe("2025-12-31");
  });
});

describe("addDaysToDateString", () => {
  it("atravessa mês e ano como calendário puro", () => {
    expect(addDaysToDateString("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDaysToDateString("2026-03-01", -1)).toBe("2026-02-28");
  });
});
