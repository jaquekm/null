import { describe, expect, it } from "vitest";
import { computeSettlementTransfers } from "./settlement-transfers";

describe("computeSettlementTransfers", () => {
  it("dois participantes: uma transferência só", () => {
    const transfers = computeSettlementTransfers([
      { personId: "ana", balanceCents: -5000 },
      { personId: "me", balanceCents: 5000 },
    ]);
    expect(transfers).toEqual([{ from: "ana", to: "me", amountCents: 5000 }]);
  });

  it("um credor, dois devedores: cada devedor paga o credor (exemplo clássico 300/200/100)", () => {
    const transfers = computeSettlementTransfers([
      { personId: "a", balanceCents: 300 },
      { personId: "b", balanceCents: -200 },
      { personId: "c", balanceCents: -100 },
    ]);
    expect(transfers).toEqual([
      { from: "b", to: "a", amountCents: 200 },
      { from: "c", to: "a", amountCents: 100 },
    ]);
  });

  it("dois credores, dois devedores com o mesmo valor: pareia sem sobra (2 transferências, não 4)", () => {
    const transfers = computeSettlementTransfers([
      { personId: "a", balanceCents: 5000 },
      { personId: "b", balanceCents: 5000 },
      { personId: "c", balanceCents: -5000 },
      { personId: "d", balanceCents: -5000 },
    ]);
    expect(transfers).toHaveLength(2);
    expect(transfers).toEqual([
      { from: "c", to: "a", amountCents: 5000 },
      { from: "d", to: "b", amountCents: 5000 },
    ]);
  });

  it("saldo desproporcional: um devedor paga parte a cada credor até quitar", () => {
    // credor a=800, credor b=200; devedor c=1000 — c paga 800 pro a (maior credor primeiro), depois 200 pro b.
    const transfers = computeSettlementTransfers([
      { personId: "a", balanceCents: 800 },
      { personId: "b", balanceCents: 200 },
      { personId: "c", balanceCents: -1000 },
    ]);
    expect(transfers).toEqual([
      { from: "c", to: "a", amountCents: 800 },
      { from: "c", to: "b", amountCents: 200 },
    ]);
  });

  it("tudo zerado: nenhuma transferência", () => {
    expect(computeSettlementTransfers([{ personId: "a", balanceCents: 0 }, { personId: "b", balanceCents: 0 }])).toEqual([]);
  });

  it("entrada zerada no meio: ignorada (nem credora nem devedora)", () => {
    const transfers = computeSettlementTransfers([
      { personId: "a", balanceCents: 5000 },
      { personId: "b", balanceCents: 0 },
      { personId: "c", balanceCents: -5000 },
    ]);
    expect(transfers).toEqual([{ from: "c", to: "a", amountCents: 5000 }]);
  });

  it("só credores, sem devedores: nenhuma transferência (não há de onde tirar)", () => {
    expect(computeSettlementTransfers([{ personId: "a", balanceCents: 5000 }])).toEqual([]);
  });

  it("lista vazia: nenhuma transferência", () => {
    expect(computeSettlementTransfers([])).toEqual([]);
  });

  it("resultado sempre fecha: soma recebida por cada credor bate com o saldo original", () => {
    const balances = [
      { personId: "a", balanceCents: 4321 },
      { personId: "b", balanceCents: 1234 },
      { personId: "c", balanceCents: -3000 },
      { personId: "d", balanceCents: -2555 },
    ];
    const transfers = computeSettlementTransfers(balances);
    const receivedByPerson = new Map<string, number>();
    const paidByPerson = new Map<string, number>();
    for (const t of transfers) {
      receivedByPerson.set(t.to, (receivedByPerson.get(t.to) ?? 0) + t.amountCents);
      paidByPerson.set(t.from, (paidByPerson.get(t.from) ?? 0) + t.amountCents);
    }
    expect(receivedByPerson.get("a")).toBe(4321);
    expect(receivedByPerson.get("b")).toBe(1234);
    expect(paidByPerson.get("c")).toBe(3000);
    expect(paidByPerson.get("d")).toBe(2555);
  });
});
