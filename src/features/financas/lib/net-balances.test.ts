import { describe, expect, it } from "vitest";
import { computeNetBalances, ME } from "./net-balances";

describe("computeNetBalances", () => {
  it("eu paguei, dois contatos devem: saldo positivo pra mim, negativo pra cada um", () => {
    const splits = [{ id: "split-1", paidByContactId: null }];
    const shares = [
      { splitId: "split-1", contactId: null, shareCents: 3334, settledCents: 3334 }, // minha parte, pré-quitada
      { splitId: "split-1", contactId: "ana", shareCents: 3333, settledCents: 0 },
      { splitId: "split-1", contactId: "pedro", shareCents: 3333, settledCents: 0 },
    ];
    const balances = computeNetBalances(splits, shares);
    expect(balances.get(ME)).toBe(6666);
    expect(balances.get("ana")).toBe(-3333);
    expect(balances.get("pedro")).toBe(-3333);
  });

  it("um contato pagou, eu devo: saldo negativo pra mim, positivo pro contato", () => {
    const splits = [{ id: "split-1", paidByContactId: "ana" }];
    const shares = [
      { splitId: "split-1", contactId: "ana", shareCents: 5000, settledCents: 5000 }, // parte da Ana, pré-quitada
      { splitId: "split-1", contactId: null, shareCents: 5000, settledCents: 0 },
    ];
    const balances = computeNetBalances(splits, shares);
    expect(balances.get("ana")).toBe(5000);
    expect(balances.get(ME)).toBe(-5000);
  });

  it("parte já quitada (settled_cents == share_cents): não conta mais no saldo", () => {
    const splits = [{ id: "split-1", paidByContactId: null }];
    const shares = [
      { splitId: "split-1", contactId: null, shareCents: 5000, settledCents: 5000 },
      { splitId: "split-1", contactId: "ana", shareCents: 5000, settledCents: 5000 },
    ];
    const balances = computeNetBalances(splits, shares);
    expect(balances.get(ME) ?? 0).toBe(0);
    expect(balances.get("ana") ?? 0).toBe(0);
  });

  it("parte parcialmente quitada: saldo é só o restante", () => {
    const splits = [{ id: "split-1", paidByContactId: null }];
    const shares = [
      { splitId: "split-1", contactId: null, shareCents: 5000, settledCents: 5000 },
      { splitId: "split-1", contactId: "ana", shareCents: 5000, settledCents: 2000 },
    ];
    const balances = computeNetBalances(splits, shares);
    expect(balances.get(ME)).toBe(3000);
    expect(balances.get("ana")).toBe(-3000);
  });

  it("várias divisões do mesmo grupo se acumulam por pessoa", () => {
    const splits = [
      { id: "split-1", paidByContactId: null },
      { id: "split-2", paidByContactId: "pedro" },
    ];
    const shares = [
      { splitId: "split-1", contactId: null, shareCents: 5000, settledCents: 5000 },
      { splitId: "split-1", contactId: "ana", shareCents: 5000, settledCents: 0 }, // ana me deve 5000
      { splitId: "split-2", contactId: "pedro", shareCents: 6000, settledCents: 6000 },
      { splitId: "split-2", contactId: "ana", shareCents: 3000, settledCents: 0 }, // ana deve 3000 ao pedro
    ];
    const balances = computeNetBalances(splits, shares);
    expect(balances.get(ME)).toBe(5000);
    expect(balances.get("ana")).toBe(-8000);
    expect(balances.get("pedro")).toBe(3000);
  });

  it("split fora do conjunto de shares informado: ignorado, sem quebrar", () => {
    const balances = computeNetBalances([{ id: "split-1", paidByContactId: null }], [{ splitId: "split-outro", contactId: "ana", shareCents: 1000, settledCents: 0 }]);
    expect(balances.size).toBe(0);
  });

  it("saldo total sempre soma zero (invariante do algoritmo de acerto)", () => {
    const splits = [
      { id: "split-1", paidByContactId: null },
      { id: "split-2", paidByContactId: "pedro" },
    ];
    const shares = [
      { splitId: "split-1", contactId: null, shareCents: 4000, settledCents: 4000 },
      { splitId: "split-1", contactId: "ana", shareCents: 3000, settledCents: 0 },
      { splitId: "split-1", contactId: "pedro", shareCents: 3000, settledCents: 1000 },
      { splitId: "split-2", contactId: "pedro", shareCents: 5000, settledCents: 5000 },
      { splitId: "split-2", contactId: "ana", shareCents: 2500, settledCents: 0 },
      { splitId: "split-2", contactId: null, shareCents: 2500, settledCents: 0 },
    ];
    const balances = computeNetBalances(splits, shares);
    const total = [...balances.values()].reduce((sum, v) => sum + v, 0);
    expect(total).toBe(0);
  });
});
