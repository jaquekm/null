import type { SubscriptionForSavings } from "./subscription-savings";

export interface HubCostForBalance {
  referenceMonth: string; // "yyyy-MM-dd", sempre primeiro dia do mês
  amountCents: number;
}

export interface MonthBalance {
  month: string; // "yyyy-MM"
  savingsCents: number;
  costsCents: number;
  balanceCents: number;
}

/**
 * Saldo mensal (7.8), só em BRL — os custos variáveis de IA/uso (`usage_events`,
 * 2.3) ficam de fora de propósito: são cobrados em USD e o app não tem taxa de
 * câmbio pra converter (mesma decisão da página `/configuracoes/uso`, que
 * mostra o gasto em dólar sem tentar converter). `savingsCents` de um mês soma
 * toda assinatura já cancelada até aquele mês (`canceled_at <= mês`) — uma vez
 * cancelada, a economia se mantém nos meses seguintes.
 */
export function computeMonthlyBalanceSeries(
  subscriptions: SubscriptionForSavings[],
  costs: HubCostForBalance[],
  months: string[],
): MonthBalance[] {
  return months.map((month) => {
    const savingsCents = subscriptions
      .filter((sub) => sub.canceledAt != null && sub.canceledAt.slice(0, 7) <= month)
      .reduce((sum, sub) => sum + sub.monthlyCostCents, 0);

    const costsCents = costs
      .filter((cost) => cost.referenceMonth.slice(0, 7) === month)
      .reduce((sum, cost) => sum + cost.amountCents, 0);

    return { month, savingsCents, costsCents, balanceCents: savingsCents - costsCents };
  });
}
