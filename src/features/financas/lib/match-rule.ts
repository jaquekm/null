import { normalizeDescription } from "./normalize-description";

export const RULE_MATCH_FIELDS = ["description", "original_description"] as const;
export type RuleMatchField = (typeof RULE_MATCH_FIELDS)[number];

export const RULE_MATCH_TYPES = ["contains", "starts_with", "equals", "regex"] as const;
export type RuleMatchType = (typeof RULE_MATCH_TYPES)[number];

export interface CategorizationRule {
  id: string;
  matchField: RuleMatchField;
  matchType: RuleMatchType;
  pattern: string;
  accountId: string | null;
  amountMinCents: number | null;
  amountMaxCents: number | null;
  setCategoryId: string | null;
  setContactId: string | null;
  setDescription: string | null;
  setSpaceId: string | null;
  priority: number;
}

export interface TransactionForRuleMatch {
  description: string;
  originalDescription: string | null;
  accountId: string;
  amountCents: number;
}

function fieldValue(transaction: TransactionForRuleMatch, field: RuleMatchField): string {
  return (field === "original_description" ? transaction.originalDescription : transaction.description) ?? "";
}

/**
 * `contains`/`starts_with`/`equals` comparam o texto normalizado (maiúsculas
 * e acentos não importam — mesma normalização usada pra aprender com
 * correções, que gera o padrão a partir da descrição normalizada). `regex` é
 * aplicada sobre o texto cru, sem normalizar (quem escreve uma regex quer
 * controle explícito), só com `i` pra não obrigar a lidar com maiúsculas.
 */
function testPattern(value: string, pattern: string, matchType: RuleMatchType): boolean {
  if (matchType === "regex") {
    if (!pattern.trim()) return false;
    try {
      return new RegExp(pattern, "i").test(value);
    } catch {
      return false;
    }
  }

  const normalizedValue = normalizeDescription(value);
  const normalizedPattern = normalizeDescription(pattern);
  if (!normalizedPattern) return false;

  if (matchType === "contains") return normalizedValue.includes(normalizedPattern);
  if (matchType === "starts_with") return normalizedValue.startsWith(normalizedPattern);
  return normalizedValue === normalizedPattern; // equals
}

/** Uma regra isolada casa com o lançamento? (4.6) — usado tanto por `matchRule` quanto por "Testar nos últimos 90 dias". */
export function ruleMatchesTransaction(rule: CategorizationRule, transaction: TransactionForRuleMatch): boolean {
  if (rule.accountId && rule.accountId !== transaction.accountId) return false;
  if (rule.amountMinCents != null && transaction.amountCents < rule.amountMinCents) return false;
  if (rule.amountMaxCents != null && transaction.amountCents > rule.amountMaxCents) return false;
  return testPattern(fieldValue(transaction, rule.matchField), rule.pattern, rule.matchType);
}

/** "Aplicação: primeira regra que casar por prioridade" (4.6) — menor número de `priority` vence. */
export function matchRule(transaction: TransactionForRuleMatch, rules: CategorizationRule[]): CategorizationRule | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  return sorted.find((rule) => ruleMatchesTransaction(rule, transaction)) ?? null;
}
