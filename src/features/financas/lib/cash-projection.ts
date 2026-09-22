import type { Cents } from "@/lib/money";

export interface CashEvent {
  /** `yyyy-MM-dd` */
  date: string;
  /** Positivo = entra (a receber), negativo = sai (a pagar) — mesmo sinal de `fin_transactions.amount_cents`. */
  amountCents: Cents;
}

export interface ProjectedDay {
  date: string;
  balanceCents: Cents;
}

/**
 * "Saldo projetado por dia" (4.12, próximos 30 dias): saldo atual + eventos
 * futuros (contas a pagar/receber em aberto, na data de vencimento),
 * acumulado dia a dia. `days` já vem pronta e ordenada (o "próximos N dias"
 * é decidido por quem chama — datas sem evento simplesmente repetem o saldo
 * do dia anterior).
 */
export function computeCashProjection(startingBalanceCents: Cents, events: CashEvent[], days: string[]): ProjectedDay[] {
  const netByDate = new Map<string, Cents>();
  for (const event of events) {
    netByDate.set(event.date, (netByDate.get(event.date) ?? 0) + event.amountCents);
  }

  let running = startingBalanceCents;
  return days.map((date) => {
    running += netByDate.get(date) ?? 0;
    return { date, balanceCents: running };
  });
}
