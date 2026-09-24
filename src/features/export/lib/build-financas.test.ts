import { describe, expect, it } from "vitest";
import { buildAccountsCsv, buildBillsCsv, buildSplitsCsv } from "./build-financas";

describe("buildAccountsCsv", () => {
  it("formata valores em centavos como decimal vírgula", () => {
    const csv = buildAccountsCsv([
      {
        name: "Conta Corrente",
        kind: "checking",
        institution: "Banco X",
        spaceName: "Pessoal",
        openingBalanceCents: 150000,
        openingDate: "2026-01-01",
        creditLimitCents: null,
        includeInTotals: true,
      },
    ]);
    expect(csv).toContain("Conta Corrente;checking;Banco X;Pessoal;1500,00;2026-01-01;;Sim");
  });
});

describe("buildBillsCsv", () => {
  it("traduz a direção pra português", () => {
    const csv = buildBillsCsv([
      {
        direction: "payable",
        description: "Aluguel",
        contactName: null,
        categoryName: "Moradia",
        accountName: "Conta Corrente",
        amountCents: 200000,
        paidCents: 0,
        dueOn: "2026-02-05",
        status: "open",
      },
    ]);
    expect(csv).toContain("A pagar;Aluguel;;Moradia;Conta Corrente;2000,00;0,00;2026-02-05;open");
  });
});

describe("buildSplitsCsv", () => {
  it("uma linha por parte da divisão", () => {
    const csv = buildSplitsCsv([
      {
        title: "Jantar",
        occurredOn: "2026-01-10",
        totalCents: 10000,
        paidByName: "Eu",
        method: "equal",
        groupLabel: "Viagem",
        status: "open",
        shareContactName: "Ana",
        shareCents: 5000,
        settledCents: 0,
      },
    ]);
    expect(csv).toContain("Jantar;2026-01-10;100,00;Eu;equal;Viagem;open;Ana;50,00;0,00");
  });
});
