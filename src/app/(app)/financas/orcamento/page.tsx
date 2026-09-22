import { formatInTimeZone } from "date-fns-tz";
import { redirect } from "next/navigation";
import { BudgetWorkspace } from "@/features/financas/components/budget-workspace";
import { computeCategoryBudgetProgress, sumExpensesByCategory } from "@/features/financas/lib/budget-progress";
import { monthPeriod } from "@/features/financas/lib/period-range";
import { getUserTimezone, isFinanceOnboardingCompleted, listCategories, listTransactions, type CategoryRow } from "@/features/financas/queries";
import type { CategoryBudgetRow } from "@/features/financas/actions";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

function buildRows(categories: CategoryRow[], transactions: { categoryId: string | null; amountCents: number }[]): CategoryBudgetRow[] {
  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const spentByCategory = sumExpensesByCategory(transactions);
  const progress = computeCategoryBudgetProgress(
    expenseCategories.map((c) => ({ id: c.id, budgetCents: c.monthlyBudgetCents })),
    spentByCategory,
  );
  const progressById = new Map(progress.map((p) => [p.categoryId, p]));

  return expenseCategories.map((category) => ({
    categoryId: category.id,
    categoryName: category.name,
    parentId: category.parentId,
    budgetCents: category.monthlyBudgetCents,
    spentCents: progressById.get(category.id)!.spentCents,
    percent: progressById.get(category.id)!.percent,
    status: progressById.get(category.id)!.status,
  }));
}

/** `/financas/orcamento` (4.11) — gasto × orçamento por categoria de despesa, mês navegável, filtro de espaço. */
export default async function OrcamentoPage() {
  const { supabase, user } = await requireOwner();

  const completed = await isFinanceOnboardingCompleted(supabase, user.id);
  if (!completed) redirect("/financas/configurar");

  const timezone = await getUserTimezone(supabase, user.id);
  const period = monthPeriod(formatInTimeZone(new Date(), timezone, "yyyy-MM"));

  const [categories, spaces, transactions] = await Promise.all([
    listCategories(supabase),
    listActiveSpaces(supabase),
    listTransactions(supabase, { periodStart: period.start, periodEnd: period.end, type: "expense" }),
  ]);

  return (
    <BudgetWorkspace
      spaces={spaces}
      initialMonth={period.month}
      initialRows={buildRows(
        categories,
        transactions.map((t) => ({ categoryId: t.categoryId, amountCents: t.amountCents })),
      )}
    />
  );
}
