import { describe, expect, it } from "vitest";
import { matchRule, ruleMatchesTransaction, type CategorizationRule, type TransactionForRuleMatch } from "./match-rule";

function rule(overrides: Partial<CategorizationRule> = {}): CategorizationRule {
  return {
    id: "rule-1",
    matchField: "description",
    matchType: "contains",
    pattern: "uber",
    accountId: null,
    amountMinCents: null,
    amountMaxCents: null,
    setCategoryId: "cat-transporte",
    setContactId: null,
    setDescription: null,
    setSpaceId: null,
    priority: 100,
    ...overrides,
  };
}

function tx(overrides: Partial<TransactionForRuleMatch> = {}): TransactionForRuleMatch {
  return { description: "UBER *TRIP HELP.UBER.COM", originalDescription: null, accountId: "acc-1", amountCents: -2500, ...overrides };
}

describe("ruleMatchesTransaction", () => {
  it("contains: ignora acentos/caixa", () => {
    expect(ruleMatchesTransaction(rule({ pattern: "Uber" }), tx())).toBe(true);
    expect(ruleMatchesTransaction(rule({ pattern: "pao de acucar" }), tx({ description: "Pão de Açúcar" }))).toBe(true);
  });

  it("starts_with", () => {
    expect(ruleMatchesTransaction(rule({ matchType: "starts_with", pattern: "uber" }), tx())).toBe(true);
    expect(ruleMatchesTransaction(rule({ matchType: "starts_with", pattern: "trip" }), tx())).toBe(false);
  });

  it("equals: precisa bater o texto inteiro (normalizado)", () => {
    expect(ruleMatchesTransaction(rule({ matchType: "equals", pattern: "uber" }), tx({ description: "Uber" }))).toBe(true);
    expect(ruleMatchesTransaction(rule({ matchType: "equals", pattern: "uber" }), tx())).toBe(false);
  });

  it("regex: case-insensitive, sobre o texto cru", () => {
    expect(ruleMatchesTransaction(rule({ matchType: "regex", pattern: "^UBER" }), tx())).toBe(true);
    expect(ruleMatchesTransaction(rule({ matchType: "regex", pattern: "^uber" }), tx())).toBe(true);
  });

  it("regex inválida: não lança, só não casa", () => {
    expect(() => ruleMatchesTransaction(rule({ matchType: "regex", pattern: "(" }), tx())).not.toThrow();
    expect(ruleMatchesTransaction(rule({ matchType: "regex", pattern: "(" }), tx())).toBe(false);
  });

  it("match_field = original_description", () => {
    const transaction = tx({ description: "Uber", originalDescription: "UBER *TRIP HELP.UBER.COM" });
    expect(ruleMatchesTransaction(rule({ matchField: "original_description", pattern: "help.uber.com" }), transaction)).toBe(true);
    expect(ruleMatchesTransaction(rule({ matchField: "original_description", pattern: "inexistente" }), transaction)).toBe(false);
  });

  it("accountId null: casa em qualquer conta", () => {
    expect(ruleMatchesTransaction(rule({ accountId: null }), tx({ accountId: "acc-qualquer" }))).toBe(true);
  });

  it("accountId definido: só casa nessa conta", () => {
    expect(ruleMatchesTransaction(rule({ accountId: "acc-1" }), tx({ accountId: "acc-1" }))).toBe(true);
    expect(ruleMatchesTransaction(rule({ accountId: "acc-1" }), tx({ accountId: "acc-2" }))).toBe(false);
  });

  it("faixa de valor: mínimo, máximo e os dois juntos", () => {
    expect(ruleMatchesTransaction(rule({ amountMinCents: -3000 }), tx({ amountCents: -2500 }))).toBe(true);
    expect(ruleMatchesTransaction(rule({ amountMinCents: -2000 }), tx({ amountCents: -2500 }))).toBe(false);
    expect(ruleMatchesTransaction(rule({ amountMaxCents: -2000 }), tx({ amountCents: -2500 }))).toBe(true);
    expect(ruleMatchesTransaction(rule({ amountMaxCents: -3000 }), tx({ amountCents: -2500 }))).toBe(false);
    expect(ruleMatchesTransaction(rule({ amountMinCents: -3000, amountMaxCents: -2000 }), tx({ amountCents: -2500 }))).toBe(true);
  });

  it("padrão vazio (normalizado) nunca casa, mesmo com descrição vazia", () => {
    expect(ruleMatchesTransaction(rule({ pattern: "   " }), tx({ description: "" }))).toBe(false);
  });
});

describe("matchRule", () => {
  it("nenhuma regra casa: null", () => {
    expect(matchRule(tx({ description: "Farmácia" }), [rule({ pattern: "uber" })])).toBeNull();
  });

  it("uma regra casa: devolve ela", () => {
    const r = rule({ pattern: "uber" });
    expect(matchRule(tx(), [r])).toEqual(r);
  });

  it("mais de uma casa: vence a de menor prioridade (número menor primeiro)", () => {
    const specific = rule({ id: "specific", pattern: "uber", priority: 10, setCategoryId: "cat-especifica" });
    const general = rule({ id: "general", pattern: "uber", priority: 100, setCategoryId: "cat-geral" });
    expect(matchRule(tx(), [general, specific])?.id).toBe("specific");
  });

  it("ordem da lista de entrada não importa — só a prioridade decide", () => {
    const first = rule({ id: "a", pattern: "uber", priority: 50 });
    const second = rule({ id: "b", pattern: "uber", priority: 5 });
    expect(matchRule(tx(), [first, second])?.id).toBe("b");
    expect(matchRule(tx(), [second, first])?.id).toBe("b");
  });

  it("lista de regras vazia: null", () => {
    expect(matchRule(tx(), [])).toBeNull();
  });
});
