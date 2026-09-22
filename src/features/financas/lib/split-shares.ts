import { formatBRL, parseBRL, splitByWeights, splitEqual, sumCents, type Cents } from "@/lib/money";

export const SPLIT_METHODS = ["equal", "exact", "percent", "shares"] as const;
export type SplitMethod = (typeof SPLIT_METHODS)[number];

export interface SplitParticipantInput {
  /** `null` = eu. */
  contactId: string | null;
  /** Método `exact` — valor em texto (`parseBRL`). */
  value?: string;
  /** Métodos `percent`/`shares` — peso numérico (porcentagem ou número de cotas). */
  weight?: number;
}

export interface SplitShareResult {
  contactId: string | null;
  shareCents: Cents;
  weight: number | null;
}

const PERCENT_TOLERANCE = 0.01;

/**
 * Calcula a parte de cada participante (4.9) conforme o método escolhido.
 * Lança `Error` com mensagem pronta pra mostrar ao dono quando os dados não
 * fecham — `exact` exige que a soma bata exatamente com o total (mostrado em
 * tempo real na UI antes de chegar aqui); `percent` exige soma 100%
 * (tolerância de 0,01 pra imprecisão de ponto flutuante em entradas como
 * 33,33+33,33+33,34); `equal`/`shares` reaproveitam `splitEqual`/`splitByWeights`
 * (`lib/money.ts`), que já garantem soma exata.
 */
export function computeSplitShares(method: SplitMethod, totalCents: Cents, participants: SplitParticipantInput[]): SplitShareResult[] {
  if (participants.length === 0) throw new Error("Escolha ao menos um participante.");

  if (method === "equal") {
    const shares = splitEqual(totalCents, participants.length);
    return participants.map((p, i) => ({ contactId: p.contactId, shareCents: shares[i]!, weight: null }));
  }

  if (method === "exact") {
    const cents = participants.map((p) => {
      if (!p.value?.trim()) throw new Error("Digite o valor de cada participante.");
      return parseBRL(p.value);
    });
    const sum = sumCents(cents);
    if (sum !== totalCents) {
      throw new Error(`A soma dos valores (${formatBRL(sum)}) não bate com o total (${formatBRL(totalCents)}).`);
    }
    return participants.map((p, i) => ({ contactId: p.contactId, shareCents: cents[i]!, weight: null }));
  }

  // percent / shares: ambos distribuem por peso (`splitByWeights`).
  const weights = participants.map((p) => p.weight ?? 0);
  if (weights.some((w) => !(w > 0))) throw new Error("Todo participante precisa de um peso maior que zero.");

  if (method === "percent") {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > PERCENT_TOLERANCE) throw new Error(`A soma das porcentagens (${sum}%) precisa ser 100%.`);
  }

  const shares = splitByWeights(totalCents, weights);
  return participants.map((p, i) => ({ contactId: p.contactId, shareCents: shares[i]!, weight: weights[i]! }));
}
