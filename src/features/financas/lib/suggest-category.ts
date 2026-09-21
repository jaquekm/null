export interface RecentTransactionForSuggestion {
  description: string;
  categoryId: string;
  occurredOn: string;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * "Gasto rápido" (4.4): sugere a categoria da transação mais recente com
 * descrição parecida. `recent` já vem ordenada da mais nova pra mais antiga
 * (mesma ordem da consulta), então a primeira que bater decide. "Parecida"
 * = normalizada igual, ou uma contém a outra (mín. 3 caracteres, pra não dar
 * match bobo em termos muito curtos) — ex.: "uber" combina com
 * "uber *trip help.uber.com".
 */
export function suggestCategoryId(recent: RecentTransactionForSuggestion[], description: string): string | null {
  const term = normalize(description);
  if (term.length < 3) return null;

  for (const tx of recent) {
    const candidate = normalize(tx.description);
    if (candidate.length < 3) continue;
    if (candidate === term || candidate.includes(term) || term.includes(candidate)) {
      return tx.categoryId;
    }
  }
  return null;
}
