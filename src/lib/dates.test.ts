import { describe, expect, it } from "vitest";
import { addDaysToDateString, dateInTimezone, isoToWallClock, todayInTimezone, wallClockToIso } from "./dates";

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

describe("wallClockToIso / isoToWallClock (campo data+hora)", () => {
  it("14:00 em Brasília vira 17:00Z, e volta pra 14:00 no campo", () => {
    const iso = wallClockToIso("2026-09-28T14:00", "America/Sao_Paulo");
    expect(iso).toBe("2026-09-28T17:00:00.000Z");
    expect(isoToWallClock(iso, "America/Sao_Paulo")).toBe("2026-09-28T14:00");
  });

  it("valor que já é ISO com fuso passa intacto", () => {
    expect(wallClockToIso("2026-09-28T17:00:00.000Z")).toBe("2026-09-28T17:00:00.000Z");
  });

  it("ISO inválido vira campo vazio", () => {
    expect(isoToWallClock("não é data")).toBe("");
  });
});

describe("addDaysToDateString", () => {
  it("atravessa mês e ano como calendário puro", () => {
    expect(addDaysToDateString("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDaysToDateString("2026-03-01", -1)).toBe("2026-02-28");
  });
});
