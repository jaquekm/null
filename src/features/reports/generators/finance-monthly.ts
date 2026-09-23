import "server-only";
import { z } from "zod";
import { computeCategoryBudgetProgress, sumExpensesByCategory, type CategoryBudgetProgress } from "@/features/financas/lib/budget-progress";
import { listBills, listCategories, listContactBalances, listTransactions } from "@/features/financas/queries";
import type { TransactionForTopExpenses } from "@/features/financas/lib/transaction-totals";
import { topExpenses } from "@/features/financas/lib/transaction-totals";
import { getDashboardData, type DashboardCards } from "@/features/financas/queries";
import { monthPeriod, shiftMonth } from "@/features/financas/lib/period-range";
import { sumCents } from "@/lib/money";
import { baseReportParamsSchema } from "../schemas";
import type { ReportContext, ReportGenerator } from "../types";

export const financeMonthlyParamsSchema = baseReportParamsSchema;
export type FinanceMonthlyParams = z.infer<typeof financeMonthlyParamsSchema>;

export interface FinanceMonthlyData {
  month: string;
  label: string;
  cards: DashboardCards;
  initialBalanceCents: number;
  previousMonthResultCents: number | null;
  avgResultLast3MonthsCents: number;
  categoryBudget: (CategoryBudgetProgress & { categoryName: string })[];
  topExpenses: TransactionForTopExpenses[];
  cardStatements: { accountName: string; totalCents: number; status: string; dueOn: string }[];
  billsPaid: { description: string; amountCents: number; direction: string }[];
  billsOpen: { description: string; amountCents: number; dueOn: string; direction: string }[];
  splitBalanceCents: number;
}

/**
 * "Relatório financeiro do mês" (6.2, o exemplo do "entregável usável" da
 * fase) — reaproveita `getDashboardData` (4.12) pro grosso (cards, fluxo,
 * categoria × mês anterior, maiores gastos) e acrescenta só o que falta
 * pro relatório: saldo inicial (aproximado por `saldo final - resultado do
 * mês` — sem uma consulta de "saldo na data X" dedicada), média de 3
 * meses, orçamento por categoria (4.11), faturas fechadas, contas pagas no
 * período e em aberto, divisões em aberto.
 */
export const financeMonthlyReport: ReportGenerator<FinanceMonthlyParams, FinanceMonthlyData> = {
  kind: "finance_monthly",
  label: "Financeiro mensal",
  paramsSchema: financeMonthlyParamsSchema,

  async collect(ctx: ReportContext<FinanceMonthlyParams>): Promise<FinanceMonthlyData> {
    const { supabase, params, startDateKey } = ctx;
    const month = startDateKey.slice(0, 7);
    const period = monthPeriod(month);

    const dashboard = await getDashboardData(supabase, ctx.ownerId, { month, spaceId: params.spaceId ?? undefined });

    const last3Months = [shiftMonth(month, -2), shiftMonth(month, -1), month];
    const last3Cashflow = dashboard.cashflow.filter((row) => last3Months.includes(row.month));
    const avgResultLast3MonthsCents = last3Cashflow.length === 0 ? 0 : Math.round(sumCents(last3Cashflow.map((row) => row.resultCents)) / last3Cashflow.length);
    const previousMonthResultCents = dashboard.cashflow.find((row) => row.month === shiftMonth(month, -1))?.resultCents ?? null;

    const [categories, statementsResult, paidBills, openPayable, openReceivable, contactBalances] = await Promise.all([
      listCategories(supabase),
      supabase
        .from("fin_card_statements")
        .select("id, status, due_on, paid_cents, fin_accounts(name)")
        .eq("reference_month", `${month}-01`),
      listBills(supabase, { tab: "paid", spaceId: params.spaceId ?? undefined }, period.end),
      listBills(supabase, { tab: "payable", spaceId: params.spaceId ?? undefined }, period.end),
      listBills(supabase, { tab: "receivable", spaceId: params.spaceId ?? undefined }, period.end),
      listContactBalances(supabase),
    ]);

    const monthTransactions = await listTransactions(supabase, { periodStart: period.start, periodEnd: period.end, spaceId: params.spaceId ?? undefined });
    const spentByCategory = sumExpensesByCategory(monthTransactions.filter((t) => t.kind === "normal"));
    const expenseCategories = categories.filter((c) => c.kind === "expense");
    const categoryBudget = computeCategoryBudgetProgress(
      expenseCategories.map((c) => ({ id: c.id, budgetCents: c.monthlyBudgetCents })),
      spentByCategory,
    )
      .filter((progress) => progress.budgetCents != null)
      .map((progress) => ({ ...progress, categoryName: expenseCategories.find((c) => c.id === progress.categoryId)?.name ?? "" }));

    const cardStatements = (statementsResult.data ?? []).map((row) => ({
      accountName: (row.fin_accounts as unknown as { name: string } | null)?.name ?? "Cartão",
      totalCents: row.paid_cents,
      status: row.status,
      dueOn: row.due_on,
    }));

    const billsPaidInPeriod = paidBills.filter((bill) => bill.dueOn >= period.start && bill.dueOn <= period.end);

    return {
      month,
      label: period.label,
      cards: dashboard.cards,
      initialBalanceCents: dashboard.cards.totalBalanceCents - dashboard.cards.resultCents,
      previousMonthResultCents,
      avgResultLast3MonthsCents,
      categoryBudget,
      topExpenses: topExpenses(monthTransactions, 10),
      cardStatements,
      billsPaid: billsPaidInPeriod.map((bill) => ({ description: bill.description, amountCents: bill.paidCents, direction: bill.direction })),
      billsOpen: [...openPayable, ...openReceivable].map((bill) => ({
        description: bill.description,
        amountCents: bill.amountCents - bill.paidCents,
        dueOn: bill.dueOn,
        direction: bill.direction,
      })),
      splitBalanceCents: sumCents([...contactBalances.values()]),
    };
  },

  title(_params, _start, endDateKey) {
    return `Financeiro — ${monthPeriod(endDateKey.slice(0, 7)).label}`;
  },
};
