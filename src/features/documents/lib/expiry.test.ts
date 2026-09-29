import { describe, expect, it } from "vitest";
import { expiryAlerts, expiryOf, expiryStatus, formatExpiry, suggestExpiryFromText } from "./expiry";

const TODAY = "2026-09-29";

describe("expiryOf", () => {
  it("só aceita data real yyyy-MM-dd", () => {
    expect(expiryOf({ validade: "2031-03-12" })).toBe("2031-03-12");
    expect(expiryOf({ validade: "2031-02-30" })).toBeNull();
    expect(expiryOf({ validade: "12/03/2031" })).toBeNull();
    expect(expiryOf({ validade: 20310312 })).toBeNull();
    expect(expiryOf({})).toBeNull();
    expect(expiryOf(null)).toBeNull();
  });
});

describe("expiryStatus", () => {
  it.each([
    ["2026-09-26", "expired", "venceu há 3 dias"],
    ["2026-09-28", "expired", "venceu ontem"],
    ["2026-09-29", "today", "vence hoje"],
    ["2026-09-30", "soon", "vence amanhã"],
    ["2026-10-29", "soon", "vence em 30 dias"],
    ["2026-10-30", "ok", "vence em 31 dias"],
  ])("%s → %s (%s)", (expiry, level, label) => {
    expect(expiryStatus(expiry, TODAY)).toMatchObject({ level, label });
  });
});

describe("expiryAlerts", () => {
  it("30, 7 e 1 dia antes", () => {
    expect(expiryAlerts("2027-01-15", TODAY)).toEqual([
      { daysBefore: 30, date: "2026-12-16" },
      { daysBefore: 7, date: "2027-01-08" },
      { daysBefore: 1, date: "2027-01-14" },
    ]);
  });

  it("pula os que já passaram; o de hoje fica", () => {
    expect(expiryAlerts("2026-10-06", TODAY)).toEqual([
      { daysBefore: 7, date: "2026-09-29" },
      { daysBefore: 1, date: "2026-10-05" },
    ]);
    expect(expiryAlerts("2026-09-20", TODAY)).toEqual([]);
  });

  it("atravessa virada de mês e ano bissexto", () => {
    expect(expiryAlerts("2028-03-01", TODAY).map((a) => a.date)).toEqual(["2028-01-31", "2028-02-23", "2028-02-29"]);
  });
});

describe("formatExpiry", () => {
  it("dd/MM/yyyy", () => {
    expect(formatExpiry("2031-03-12")).toBe("12/03/2031");
  });
});

describe("suggestExpiryFromText", () => {
  it.each([
    ["CARTEIRA NACIONAL DE HABILITAÇÃO\nVALIDADE 12/03/2031\n1ª HABILITAÇÃO 05/06/2010", "2031-03-12"],
    ["Data de validade: 01.02.2030", "2030-02-01"],
    ["Válido até 15 de agosto de 2029", "2029-08-15"],
    ["Vencimento: 10/11/27", "2027-11-10"],
    ["Date of expiry / Data de validade\n14 MAR 2032", "2032-03-14"],
    ["Vigência até 2028-06-30", "2028-06-30"],
    ["Emissão 01/01/2020 Validade 01/01/2030 Validade da vistoria 01/01/2025", "2030-01-01"],
  ])("%s → %s", (text, expected) => {
    expect(suggestExpiryFromText(text)).toBe(expected);
  });

  it.each([
    ["Nascimento 12/03/1990\nEmissão 05/06/2020"],
    ["Validade: indeterminada"],
    ["Validade 31/02/2030"],
    [""],
  ])("sem validade clara → null: %s", (text) => {
    expect(suggestExpiryFromText(text)).toBeNull();
  });

  it("aceita nulo", () => {
    expect(suggestExpiryFromText(null)).toBeNull();
  });
});
