import { addMonths, format } from "date-fns";
import { splitEqual, type Cents } from "@/lib/money";

export interface InstallmentPlan {
  installmentNumber: number;
  installmentTotal: number;
  amountCents: Cents;
  occurredOn: string; // yyyy-MM-dd
}

/**
 * Parcelas de uma compra no cartão (4.4): os valores somam exatamente
 * `totalCents` (`splitEqual`, resto nos primeiros) e as datas avançam um mês
 * por parcela a partir da compra — `date-fns` `addMonths` já resolve meses
 * mais curtos (ex.: compra em 31/01 → 2ª parcela em 28/02 ou 29/02).
 * `totalCents` já vem com o sinal certo (negativo pra despesa).
 */
export function buildInstallments(purchaseDate: string, totalCents: Cents, count: number): InstallmentPlan[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("buildInstallments: count precisa ser um inteiro positivo.");
  }

  const amounts = splitEqual(totalCents, count);
  const purchase = new Date(`${purchaseDate}T00:00:00`);

  return amounts.map((amountCents, index) => ({
    installmentNumber: index + 1,
    installmentTotal: count,
    amountCents,
    occurredOn: format(addMonths(purchase, index), "yyyy-MM-dd"),
  }));
}
