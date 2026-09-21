import type { Cents } from "@/lib/money";

/** Sentinela pra "eu" nos mapas de saldo — nunca colide com um `contact_id` de verdade (uuid). */
export const ME = "me" as const;

export interface SplitForBalance {
  id: string;
  /** `null` = eu paguei. */
  paidByContactId: string | null;
}

export interface ShareForBalance {
  splitId: string;
  /** `null` = minha parte. */
  contactId: string | null;
  shareCents: Cents;
  settledCents: Cents;
}

/**
 * Saldo líquido de cada pessoa (contato ou `ME`, "eu") dentro de um conjunto
 * de divisões (4.9) — positivo = a pessoa é credora (é devida), negativo =
 * devedora. A parte de quem pagou o próprio split nunca gera saldo (ela já
 * "pagou" a própria fatia ao pagar o total); as demais partes ainda em
 * aberto (`share_cents - settled_cents`) geram um crédito pra quem pagou e
 * um débito equivalente pra quem deve, entrada usada por
 * `computeSettlementTransfers` pra achar o menor número de transferências.
 */
export function computeNetBalances(splits: SplitForBalance[], shares: ShareForBalance[]): Map<string, Cents> {
  const payerBySplit = new Map(splits.map((s) => [s.id, s.paidByContactId ?? ME]));
  const balances = new Map<string, Cents>();

  function add(personId: string, delta: Cents): void {
    balances.set(personId, (balances.get(personId) ?? 0) + delta);
  }

  for (const share of shares) {
    const payer = payerBySplit.get(share.splitId);
    if (!payer) continue; // split fora do conjunto informado (ex.: cancelada, filtrada antes)

    const owner = share.contactId ?? ME;
    if (owner === payer) continue; // a própria parte de quem pagou não gera saldo

    const remaining = share.shareCents - share.settledCents;
    if (remaining === 0) continue;

    add(payer, remaining);
    add(owner, -remaining);
  }

  return balances;
}
