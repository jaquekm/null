export interface BillForMatching {
  id: string;
  direction: "payable" | "receivable";
  /** `amount_cents - paid_cents` — o que ainda falta pagar/receber (uma fatura parcial não deve casar pelo valor original). */
  remainingCents: number;
  dueOn: string;
  description: string;
}

export interface TransactionForBillMatch {
  amountCents: number;
  occurredOn: string;
}

export interface BillMatch {
  billId: string;
  description: string;
}

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * "Conciliação com contas a pagar" (4.5): sugere vincular a uma conta aberta
 * da mesma direção (despesa → `payable`, receita → `receivable`), com o
 * mesmo valor restante e vencimento a até 5 dias da data do lançamento. Mais
 * de uma candidata: a de vencimento mais próximo da data do lançamento.
 */
export function matchBills(transaction: TransactionForBillMatch, openBills: BillForMatching[]): BillMatch | null {
  const direction = transaction.amountCents < 0 ? "payable" : "receivable";
  const amountAbs = Math.abs(transaction.amountCents);
  const txTime = new Date(`${transaction.occurredOn}T00:00:00`).getTime();

  let best: { bill: BillForMatching; diff: number } | null = null;
  for (const bill of openBills) {
    if (bill.direction !== direction) continue;
    if (bill.remainingCents !== amountAbs) continue;

    const diff = Math.abs(new Date(`${bill.dueOn}T00:00:00`).getTime() - txTime);
    if (diff > FIVE_DAYS_MS) continue;
    if (!best || diff < best.diff) best = { bill, diff };
  }

  return best ? { billId: best.bill.id, description: best.bill.description } : null;
}
