import { describe, expect, it } from "vitest";
import { sumCents } from "@/lib/money";
import { buildInstallments } from "./installments";

describe("buildInstallments", () => {
  it("soma das parcelas sempre bate com o total (inclusive com resto)", () => {
    const plan = buildInstallments("2026-01-15", -100000, 3);
    expect(sumCents(plan.map((p) => p.amountCents))).toBe(-100000);
    expect(plan.map((p) => p.amountCents)).toEqual([-33334, -33333, -33333]);
  });

  it("numera as parcelas e registra o total em cada uma", () => {
    const plan = buildInstallments("2026-01-15", -30000, 3);
    expect(plan.map((p) => [p.installmentNumber, p.installmentTotal])).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("datas avançam um mês por parcela a partir da compra", () => {
    const plan = buildInstallments("2026-03-10", -30000, 3);
    expect(plan.map((p) => p.occurredOn)).toEqual(["2026-03-10", "2026-04-10", "2026-05-10"]);
  });

  it("compra no dia 31: mês mais curto cai no último dia dele", () => {
    const plan = buildInstallments("2026-01-31", -20000, 2);
    expect(plan.map((p) => p.occurredOn)).toEqual(["2026-01-31", "2026-02-28"]);
  });

  it("vira o ano corretamente", () => {
    const plan = buildInstallments("2026-11-20", -20000, 4);
    expect(plan.map((p) => p.occurredOn)).toEqual(["2026-11-20", "2026-12-20", "2027-01-20", "2027-02-20"]);
  });

  it("1 parcela: uma linha só, valor cheio", () => {
    const plan = buildInstallments("2026-01-15", -15000, 1);
    expect(plan).toEqual([{ installmentNumber: 1, installmentTotal: 1, amountCents: -15000, occurredOn: "2026-01-15" }]);
  });

  it("count inválido lança erro", () => {
    expect(() => buildInstallments("2026-01-15", -1000, 0)).toThrow();
    expect(() => buildInstallments("2026-01-15", -1000, 1.5)).toThrow();
  });
});
