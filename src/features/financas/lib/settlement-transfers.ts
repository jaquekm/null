import type { Cents } from "@/lib/money";

export interface PersonBalance {
  personId: string;
  /** Positivo = credor (é devido). Negativo = devedor. A soma de todos precisa ser zero. */
  balanceCents: Cents;
}

export interface SettlementTransfer {
  from: string;
  to: string;
  amountCents: Cents;
}

/**
 * "Visão de acerto" de um grupo (4.9): quantas transferências no mínimo
 * zeram todos os saldos — algoritmo guloso (maior credor recebe do maior
 * devedor, repete até não sobrar ninguém), o padrão usado por apps de
 * divisão de conta pra minimizar o número de Pix entre as pessoas (nunca é
 * pior que "cada devedor paga cada credor", geralmente bem menor). Saldos
 * zerados (arredondamento) são ignorados.
 */
export function computeSettlementTransfers(balances: PersonBalance[]): SettlementTransfer[] {
  const creditors = balances
    .filter((b) => b.balanceCents > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.balanceCents - a.balanceCents);
  const debtors = balances
    .filter((b) => b.balanceCents < 0)
    .map((b) => ({ personId: b.personId, balanceCents: -b.balanceCents }))
    .sort((a, b) => b.balanceCents - a.balanceCents);

  const transfers: SettlementTransfer[] = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i]!;
    const debtor = debtors[j]!;
    const amount = Math.min(creditor.balanceCents, debtor.balanceCents);

    if (amount > 0) transfers.push({ from: debtor.personId, to: creditor.personId, amountCents: amount });

    creditor.balanceCents -= amount;
    debtor.balanceCents -= amount;
    if (creditor.balanceCents === 0) i++;
    if (debtor.balanceCents === 0) j++;
  }

  return transfers;
}
