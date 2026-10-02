export interface Debt {
  id: string;
  name: string;
  balanceCents: number;
  monthlyRatePercent: number;
}

export const PAYOFF_STRATEGIES = ["menor_saldo", "maior_juro"] as const;
export type PayoffStrategy = (typeof PAYOFF_STRATEGIES)[number];

export interface PayoffScheduleEntry {
  id: string;
  name: string;
  /** Posição na ordem sugerida (1 = primeira a receber o orçamento). */
  order: number;
  /** `null` = não quita dentro de 50 anos com esse orçamento (os juros superam o quanto dá pra pagar). */
  monthsToPayoff: number | null;
}

/** "Bola de neve" (menor saldo primeiro) ou "avalanche" (maior juro primeiro) — só reordena, não muda nenhum valor. */
export function orderDebts(debts: Debt[], strategy: PayoffStrategy): Debt[] {
  const sorted = [...debts];
  if (strategy === "menor_saldo") sorted.sort((a, b) => a.balanceCents - b.balanceCents);
  else sorted.sort((a, b) => b.monthlyRatePercent - a.monthlyRatePercent);
  return sorted;
}

const MAX_MONTHS = 600; // 50 anos — teto de segurança: orçamento que não cobre nem os juros nunca quitaria de verdade

/**
 * Simula mês a mês (10.14): juros incidem em toda dívida aberta (mesmo a
 * que ainda não chegou sua vez — dívida sem pagamento continua rendendo
 * juros de verdade); o orçamento mensal inteiro vai pra primeira dívida
 * aberta na ordem escolhida, e o que sobrar no mesmo mês (dívida zerou
 * antes de acabar o orçamento) já rola pra próxima. `monthsToPayoff: null`
 * quando a dívida não quita dentro do teto de simulação.
 */
export function buildPayoffPlan(debts: Debt[], monthlyBudgetCents: number, strategy: PayoffStrategy): PayoffScheduleEntry[] {
  const ordered = orderDebts(debts, strategy);
  const balances = new Map(ordered.map((debt) => [debt.id, debt.balanceCents]));
  const payoffMonth = new Map<string, number>();
  let activeIndex = 0;

  for (let month = 1; month <= MAX_MONTHS && activeIndex < ordered.length; month++) {
    for (const debt of ordered) {
      const balance = balances.get(debt.id)!;
      if (balance > 0) balances.set(debt.id, Math.round(balance * (1 + debt.monthlyRatePercent / 100)));
    }

    let remainingBudget = monthlyBudgetCents;
    while (remainingBudget > 0 && activeIndex < ordered.length) {
      const debt = ordered[activeIndex]!;
      const balance = balances.get(debt.id)!;
      if (balance <= 0) {
        activeIndex += 1;
        continue;
      }
      const payment = Math.min(balance, remainingBudget);
      const nextBalance = balance - payment;
      balances.set(debt.id, nextBalance);
      remainingBudget -= payment;
      if (nextBalance <= 0) {
        payoffMonth.set(debt.id, month);
        activeIndex += 1;
      } else {
        break;
      }
    }
  }

  return ordered.map((debt, index) => ({ id: debt.id, name: debt.name, order: index + 1, monthsToPayoff: payoffMonth.get(debt.id) ?? null }));
}
