import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface MonthPeriod {
  month: string; // "yyyy-MM"
  start: string; // "yyyy-MM-dd" (primeiro dia do mês)
  end: string; // "yyyy-MM-dd" (último dia do mês)
  label: string; // "Setembro de 2026"
}

/**
 * Filtro de período da página de lançamentos (4.4, "mês atual por padrão com
 * setas"). `fin_transactions.occurred_on` é `date` puro (sem hora), então o
 * intervalo do mês não precisa de conversão de fuso — só o "qual é o mês
 * atual" (calculado no fuso do dono antes de chamar isto) depende disso.
 */
export function monthPeriod(month: string): MonthPeriod {
  const reference = startOfMonth(new Date(`${month}-01T00:00:00`));
  const label = format(reference, "MMMM 'de' yyyy", { locale: ptBR });
  return {
    month: format(reference, "yyyy-MM"),
    start: format(reference, "yyyy-MM-dd"),
    end: format(endOfMonth(reference), "yyyy-MM-dd"),
    label: label.charAt(0).toUpperCase() + label.slice(1),
  };
}

/** Mês seguinte (`delta` positivo) ou anterior (negativo) a `month` — pras setas do filtro. */
export function shiftMonth(month: string, delta: number): string {
  return format(addMonths(new Date(`${month}-01T00:00:00`), delta), "yyyy-MM");
}
