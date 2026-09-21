import { describe, expect, it } from "vitest";
import { matchBills, type BillForMatching } from "./match-bills";

const ALUGUEL: BillForMatching = { id: "bill-1", direction: "payable", remainingCents: 150000, dueOn: "2026-01-10", description: "Aluguel" };
const MENSALIDADE: BillForMatching = { id: "bill-2", direction: "receivable", remainingCents: 50000, dueOn: "2026-01-05", description: "Mensalidade cliente" };

describe("matchBills", () => {
  it("despesa (valor negativo) casa com conta a pagar de mesmo valor e vencimento próximo", () => {
    const match = matchBills({ amountCents: -150000, occurredOn: "2026-01-11" }, [ALUGUEL, MENSALIDADE]);
    expect(match).toEqual({ billId: "bill-1", description: "Aluguel" });
  });

  it("receita (valor positivo) casa com conta a receber", () => {
    const match = matchBills({ amountCents: 50000, occurredOn: "2026-01-06" }, [ALUGUEL, MENSALIDADE]);
    expect(match).toEqual({ billId: "bill-2", description: "Mensalidade cliente" });
  });

  it("direção errada não casa mesmo com valor e data batendo", () => {
    // valor de MENSALIDADE (receivable) mas lançamento é despesa (negativo) — não deveria casar com ela.
    const match = matchBills({ amountCents: -50000, occurredOn: "2026-01-05" }, [MENSALIDADE]);
    expect(match).toBeNull();
  });

  it("valor diferente não casa", () => {
    const match = matchBills({ amountCents: -150001, occurredOn: "2026-01-10" }, [ALUGUEL]);
    expect(match).toBeNull();
  });

  it("dentro de 5 dias casa, no limite exato", () => {
    const match = matchBills({ amountCents: -150000, occurredOn: "2026-01-15" }, [ALUGUEL]); // 10 + 5 dias
    expect(match).toEqual({ billId: "bill-1", description: "Aluguel" });
  });

  it("fora de 5 dias não casa", () => {
    const match = matchBills({ amountCents: -150000, occurredOn: "2026-01-16" }, [ALUGUEL]); // 10 + 6 dias
    expect(match).toBeNull();
  });

  it("antes do vencimento, dentro de 5 dias, também casa", () => {
    const match = matchBills({ amountCents: -150000, occurredOn: "2026-01-06" }, [ALUGUEL]); // 4 dias antes
    expect(match).toEqual({ billId: "bill-1", description: "Aluguel" });
  });

  it("mais de um candidato: escolhe o vencimento mais próximo da data do lançamento", () => {
    const bill1: BillForMatching = { id: "b1", direction: "payable", remainingCents: 10000, dueOn: "2026-01-05", description: "Conta 1" };
    const bill2: BillForMatching = { id: "b2", direction: "payable", remainingCents: 10000, dueOn: "2026-01-08", description: "Conta 2" };
    const match = matchBills({ amountCents: -10000, occurredOn: "2026-01-07" }, [bill1, bill2]);
    expect(match?.billId).toBe("b2");
  });

  it("nenhuma conta aberta: null", () => {
    expect(matchBills({ amountCents: -1000, occurredOn: "2026-01-01" }, [])).toBeNull();
  });
});
