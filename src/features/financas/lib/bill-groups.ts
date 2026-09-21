import { endOfMonth, endOfWeek, format, parseISO } from "date-fns";

export const BILL_GROUP_KEYS = ["overdue", "today", "this_week", "this_month", "later"] as const;
export type BillGroupKey = (typeof BILL_GROUP_KEYS)[number];

export const BILL_GROUP_LABELS: Record<BillGroupKey, string> = {
  overdue: "Atrasadas",
  today: "Hoje",
  this_week: "Esta semana",
  this_month: "Este mês",
  later: "Depois",
};

/**
 * Agrupamento de `/financas/contas` (4.8). `dueOn`/`today` são `date` puras
 * (sem hora, sem fuso — `due_on` no banco já é assim), então a comparação é
 * só de string/data, sem conversão de fuso. "Esta semana"/"este mês" usam o
 * fim da semana/mês corrente (`date-fns`, domingo a sábado por padrão).
 */
export function billGroupKey(dueOn: string, today: string): BillGroupKey {
  if (dueOn < today) return "overdue";
  if (dueOn === today) return "today";

  const todayDate = parseISO(today);
  const weekEnd = format(endOfWeek(todayDate), "yyyy-MM-dd");
  if (dueOn <= weekEnd) return "this_week";

  const monthEnd = format(endOfMonth(todayDate), "yyyy-MM-dd");
  if (dueOn <= monthEnd) return "this_month";

  return "later";
}

/** Agrupa uma lista já filtrada (ex.: só as abertas de uma direção) nos 5 baldes, na ordem de exibição. */
export function groupBillsByDueDate<T extends { dueOn: string }>(bills: T[], today: string): Record<BillGroupKey, T[]> {
  const groups: Record<BillGroupKey, T[]> = { overdue: [], today: [], this_week: [], this_month: [], later: [] };
  for (const bill of bills) groups[billGroupKey(bill.dueOn, today)].push(bill);
  return groups;
}
