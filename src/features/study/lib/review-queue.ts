/**
 * Monta a fila da sessão de revisão (5.7): cards "para revisar hoje"
 * (`learning`/`review`/`relearning` com `due_at` vencido) sempre entram
 * todos; cards `new` respeitam o limite diário configurável (padrão 20),
 * descontando quantos `new` já foram mostrados hoje. Ordem simples — due
 * primeiro (já ordenados por `due_at` na query), depois os novos — não
 * intercala como o Anki faz por padrão (fora de escopo aqui).
 */
export function buildReviewQueue<T>(dueCards: T[], newCards: T[], opts: { dailyNewLimit: number; newAlreadyShownToday: number }): T[] {
  const remainingNewSlots = Math.max(0, opts.dailyNewLimit - opts.newAlreadyShownToday);
  return [...dueCards, ...newCards.slice(0, remainingNewSlots)];
}
