import { sumCents, type Cents } from "@/lib/money";

export interface TransactionForTotals {
  amountCents: Cents;
  kind: string;
}

export interface TransactionTotals {
  incomeCents: Cents;
  expenseCents: Cents;
  resultCents: Cents;
}

/**
 * "Totais do filtro: entradas, saídas, resultado" (4.4). Transferências e
 * pagamento de fatura (`kind` `transfer`/`card_payment`) são movimentação
 * entre contas, não entrada/saída de verdade — mesma exclusão que o
 * enunciado já pede explicitamente pro painel financeiro (4.12) e pra
 * transferência ("excluídas dos relatórios de despesa/receita").
 */
export function computeTransactionTotals(rows: TransactionForTotals[]): TransactionTotals {
  const counted = rows.filter((row) => row.kind === "normal" || row.kind === "adjustment");
  const incomeCents = sumCents(counted.filter((row) => row.amountCents > 0).map((row) => row.amountCents));
  const expenseCents = sumCents(counted.filter((row) => row.amountCents < 0).map((row) => row.amountCents));
  return { incomeCents, expenseCents, resultCents: incomeCents + expenseCents };
}

export interface TransactionForTopExpenses extends TransactionForTotals {
  id: string;
  description: string;
  occurredOn: string;
  categoryId: string | null;
}

/** "Maiores gastos do mês" (4.12) — só despesas de verdade (mesmo critério de `computeTransactionTotals`), mais negativa primeiro. */
export function topExpenses<T extends TransactionForTopExpenses>(rows: T[], limit: number): T[] {
  return rows
    .filter((row) => (row.kind === "normal" || row.kind === "adjustment") && row.amountCents < 0)
    .sort((a, b) => a.amountCents - b.amountCents)
    .slice(0, limit);
}
