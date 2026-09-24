export interface SubscriptionForSavings {
  monthlyCostCents: number;
  canceledAt: string | null;
}

export interface SubscriptionSavings {
  /** Soma mensal das assinaturas já canceladas de verdade — economia realizada. */
  realizedMonthlyCents: number;
  /** Soma mensal das que o Hub já substitui mas o dono ainda não cancelou — economia potencial. */
  pendingMonthlyCents: number;
  totalTrackedMonthlyCents: number;
}

/**
 * `canceled_at: null` (7.8 migration) significa "o Hub já faz isso, mas ainda
 * pago a assinatura" — não conta como economia realizada ainda, só potencial.
 */
export function computeSubscriptionSavings(subscriptions: SubscriptionForSavings[]): SubscriptionSavings {
  let realizedMonthlyCents = 0;
  let pendingMonthlyCents = 0;

  for (const sub of subscriptions) {
    if (sub.canceledAt) realizedMonthlyCents += sub.monthlyCostCents;
    else pendingMonthlyCents += sub.monthlyCostCents;
  }

  return {
    realizedMonthlyCents,
    pendingMonthlyCents,
    totalTrackedMonthlyCents: realizedMonthlyCents + pendingMonthlyCents,
  };
}
