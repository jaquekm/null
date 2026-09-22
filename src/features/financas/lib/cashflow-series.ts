import { computeTransactionTotals, type TransactionForTotals, type TransactionTotals } from "./transaction-totals";

export interface TransactionForCashflow extends TransactionForTotals {
  occurredOn: string;
}

export interface MonthCashflow extends TransactionTotals {
  month: string;
}

/**
 * Fluxo de caixa mensal (4.12, "últimos 12 meses"): agrupa por `yyyy-MM`
 * (prefixo de `occurredOn`, que é `date` puro — sem fuso pra considerar) e
 * reaproveita `computeTransactionTotals` (4.4) em cada mês, então a mesma
 * regra de "o que conta como entrada/saída" vale nos dois lugares.
 */
export function buildCashflowSeries(transactions: TransactionForCashflow[], months: string[]): MonthCashflow[] {
  return months.map((month) => {
    const rows = transactions.filter((t) => t.occurredOn.startsWith(month));
    return { month, ...computeTransactionTotals(rows) };
  });
}
