import { describe, expect, it } from "vitest";
import { nextBirthdayOccurrence } from "./next-birthday";

const timezone = "America/Sao_Paulo";

describe("nextBirthdayOccurrence", () => {
  it("antes do aniversário deste ano: devolve este ano às 9h local", () => {
    const after = new Date("2026-06-01T12:00:00.000Z"); // 09:00 em São Paulo
    const next = nextBirthdayOccurrence("1990-06-15", timezone, after);
    expect(next?.toISOString()).toBe("2026-06-15T12:00:00.000Z"); // 09:00 local
  });

  it("depois do aniversário deste ano: devolve o do ano seguinte", () => {
    const after = new Date("2026-07-01T12:00:00.000Z");
    const next = nextBirthdayOccurrence("1990-06-15", timezone, after);
    expect(next?.toISOString()).toBe("2027-06-15T12:00:00.000Z");
  });

  it("exatamente no instante da ocorrência: não conta, pega o ano seguinte", () => {
    const after = new Date("2026-06-15T12:00:00.000Z"); // exatamente 09:00 local do dia
    const next = nextBirthdayOccurrence("1990-06-15", timezone, after);
    expect(next?.toISOString()).toBe("2027-06-15T12:00:00.000Z");
  });

  it("29/02 num ano não bissexto: vira 28/02", () => {
    const after = new Date("2026-01-01T12:00:00.000Z"); // 2026 não é bissexto
    const next = nextBirthdayOccurrence("1992-02-29", timezone, after);
    expect(next?.toISOString()).toBe("2026-02-28T12:00:00.000Z"); // 09:00 local, 28/02
  });

  it("29/02 num ano bissexto: mantém 29/02", () => {
    const after = new Date("2027-06-01T12:00:00.000Z");
    const next = nextBirthdayOccurrence("1992-02-29", timezone, after); // próximo bissexto: 2028
    expect(next?.toISOString()).toBe("2028-02-29T12:00:00.000Z");
  });

  it("hora customizada (não 9h)", () => {
    const after = new Date("2026-06-01T12:00:00.000Z");
    const next = nextBirthdayOccurrence("1990-06-15", timezone, after, 14);
    expect(next?.toISOString()).toBe("2026-06-15T17:00:00.000Z"); // 14:00 local
  });

  it("string inválida: null", () => {
    expect(nextBirthdayOccurrence("não é uma data", timezone, new Date())).toBeNull();
    expect(nextBirthdayOccurrence("1990-13-40", timezone, new Date())).toBeNull();
  });
});
