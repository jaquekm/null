import { addDays, addMonths, format, getDate, getDaysInMonth, setDate, startOfMonth } from "date-fns";

export interface Statement {
  referenceMonth: string; // yyyy-MM-dd, primeiro dia do mês de vencimento
  periodStart: string; // yyyy-MM-dd
  periodEnd: string; // yyyy-MM-dd, data de fechamento
  dueOn: string; // yyyy-MM-dd
}

/** `day` no calendário de `monthAnchor`, "empurrado" pro último dia do mês quando ele não existe (ex.: 31 em fevereiro → 28 ou 29). */
function clampToMonth(monthAnchor: Date, day: number): Date {
  return setDate(monthAnchor, Math.min(day, getDaysInMonth(monthAnchor)));
}

function fmt(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Fatura de cartão que uma compra cai (4.7): compra até o dia de fechamento
 * (inclusive) do mês corrente entra na fatura que fecha nesse mês; depois
 * dele, entra na do mês seguinte. Vencimento: mesmo mês do fechamento se
 * `dueDay > closingDay` (ex.: fecha dia 5, vence dia 12); mês seguinte
 * quando não (ex.: fecha dia 25, vence dia 5 do mês depois) — não tem como
 * vencer antes de fechar. `referenceMonth` é o primeiro dia do mês de
 * vencimento (mesma convenção do comentário da coluna em `fin_card_statements`).
 */
export function statementFor(purchaseDate: string, closingDay: number, dueDay: number): Statement {
  const purchase = new Date(`${purchaseDate}T00:00:00`);
  const closingThisMonth = clampToMonth(purchase, closingDay);

  const periodEnd = getDate(purchase) <= getDate(closingThisMonth) ? closingThisMonth : clampToMonth(addMonths(purchase, 1), closingDay);

  const periodStart = addDays(clampToMonth(addMonths(periodEnd, -1), closingDay), 1);

  const dueOn = dueDay > closingDay ? clampToMonth(periodEnd, dueDay) : clampToMonth(addMonths(periodEnd, 1), dueDay);

  return {
    referenceMonth: fmt(startOfMonth(dueOn)),
    periodStart: fmt(periodStart),
    periodEnd: fmt(periodEnd),
    dueOn: fmt(dueOn),
  };
}
