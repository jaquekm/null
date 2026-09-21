import { describe, expect, it } from "vitest";
import { statementFor } from "./statements";

describe("statementFor", () => {
  it("vencimento no mesmo mês do fechamento (dueDay > closingDay): compra antes do fechamento", () => {
    // fecha dia 5, vence dia 12 — compra em 03/01 entra na fatura que fecha 05/01, vence 12/01.
    expect(statementFor("2026-01-03", 5, 12)).toEqual({
      referenceMonth: "2026-01-01",
      periodStart: "2025-12-06",
      periodEnd: "2026-01-05",
      dueOn: "2026-01-12",
    });
  });

  it("compra exatamente no dia do fechamento: ainda entra nesta fatura (inclusive)", () => {
    expect(statementFor("2026-01-05", 5, 12)).toMatchObject({ periodEnd: "2026-01-05", dueOn: "2026-01-12" });
  });

  it("compra logo depois do fechamento: cai na fatura do mês seguinte", () => {
    expect(statementFor("2026-01-06", 5, 12)).toEqual({
      referenceMonth: "2026-02-01",
      periodStart: "2026-01-06",
      periodEnd: "2026-02-05",
      dueOn: "2026-02-12",
    });
  });

  it("vencimento no mês seguinte ao fechamento (dueDay <= closingDay): compra antes do fechamento", () => {
    // fecha dia 25, vence dia 5 do mês seguinte.
    expect(statementFor("2026-01-20", 25, 5)).toEqual({
      referenceMonth: "2026-02-01",
      periodStart: "2025-12-26",
      periodEnd: "2026-01-25",
      dueOn: "2026-02-05",
    });
  });

  it("mesmo caso, compra logo depois do fechamento: mais um mês de prazo", () => {
    expect(statementFor("2026-01-26", 25, 5)).toEqual({
      referenceMonth: "2026-03-01",
      periodStart: "2026-01-26",
      periodEnd: "2026-02-25",
      dueOn: "2026-03-05",
    });
  });

  it("fechamento dia 31 em fevereiro (ano comum): cai no último dia do mês (28)", () => {
    expect(statementFor("2026-02-10", 31, 10)).toMatchObject({ periodEnd: "2026-02-28" });
  });

  it("fechamento dia 31 em fevereiro de ano bissexto: cai em 29", () => {
    expect(statementFor("2028-02-10", 31, 10)).toMatchObject({ periodEnd: "2028-02-29" });
  });

  it("fechamento dia 31: em março (31 dias) não precisa clampar", () => {
    expect(statementFor("2026-03-10", 31, 10)).toMatchObject({ periodStart: "2026-03-01", periodEnd: "2026-03-31" });
  });

  it("período seguinte ao fechamento clampado em fevereiro começa em março, não fevereiro 29+1 inexistente", () => {
    // fatura que fecha em fevereiro (28) — a próxima, com compra em março, começa 01/03.
    expect(statementFor("2026-03-05", 31, 10)).toMatchObject({ periodStart: "2026-03-01" });
  });

  it("virada de ano: compra em dezembro, fechamento depois, vence em janeiro do ano seguinte", () => {
    expect(statementFor("2026-12-28", 25, 5)).toEqual({
      referenceMonth: "2027-02-01",
      periodStart: "2026-12-26",
      periodEnd: "2027-01-25",
      dueOn: "2027-02-05",
    });
  });

  it("dueDay igual a closingDay: convenção é 'mês seguinte' (não é estritamente maior)", () => {
    const result = statementFor("2026-01-03", 10, 10);
    expect(result.periodEnd).toBe("2026-01-10");
    expect(result.dueOn).toBe("2026-02-10");
  });
});
