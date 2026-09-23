import "server-only";
import { z } from "zod";
import { sumExpensesByCategory } from "@/features/financas/lib/budget-progress";
import { monthPeriod, shiftMonth } from "@/features/financas/lib/period-range";
import { listCategories, listTransactions, type TransactionRow } from "@/features/financas/queries";
import { formatBRL } from "@/lib/money";
import type { ReportBlock } from "../lib/blocks";
import { baseReportParamsSchema } from "../schemas";
import type { ReportContext, ReportGenerator } from "../types";

export const financeCategoryParamsSchema = baseReportParamsSchema.extend({
  categoryIds: z.array(z.string().uuid()).min(1),
});
export type FinanceCategoryParams = z.infer<typeof financeCategoryParamsSchema>;

export interface CategoryMonthPoint {
  month: string;
  label: string;
  byCategoryCents: Record<string, number>;
}

export interface FinanceCategoryData {
  categories: { id: string; name: string }[];
  months: CategoryMonthPoint[];
  transactions: TransactionRow[];
}

/** "Evolução de categoria" (6.2b): 12 meses de gasto por categoria selecionada + lançamentos do período escolhido. */
export const financeCategoryReport: ReportGenerator<FinanceCategoryParams, FinanceCategoryData> = {
  kind: "finance_category",
  label: "Evolução de categoria",
  paramsSchema: financeCategoryParamsSchema,

  async collect(ctx: ReportContext<FinanceCategoryParams>): Promise<FinanceCategoryData> {
    const { supabase, params, start, end, endDateKey } = ctx;
    const referenceMonth = endDateKey.slice(0, 7);
    const months = Array.from({ length: 12 }, (_, i) => shiftMonth(referenceMonth, i - 11));
    const windowStart = monthPeriod(months[0]!).start;
    const windowEnd = monthPeriod(months[months.length - 1]!).end;

    const [categories, windowTransactions, periodTransactions] = await Promise.all([
      listCategories(supabase),
      listTransactions(supabase, { periodStart: windowStart, periodEnd: windowEnd, spaceId: params.spaceId ?? undefined }),
      listTransactions(supabase, { periodStart: start.slice(0, 10), periodEnd: end.slice(0, 10), spaceId: params.spaceId ?? undefined }),
    ]);

    const selected = categories.filter((c) => params.categoryIds.includes(c.id));

    const monthPoints: CategoryMonthPoint[] = months.map((month) => {
      const inMonth = windowTransactions.filter((t) => t.kind === "normal" && t.occurredOn.startsWith(month));
      const spent = sumExpensesByCategory(inMonth);
      const byCategoryCents: Record<string, number> = {};
      for (const category of selected) byCategoryCents[category.id] = spent.get(category.id) ?? 0;
      return { month, label: monthPeriod(month).label, byCategoryCents };
    });

    const transactions = periodTransactions
      .filter((t) => t.categoryId && params.categoryIds.includes(t.categoryId))
      .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
      .slice(0, 50);

    return { categories: selected, months: monthPoints, transactions };
  },

  title(_params, startDateKey, endDateKey) {
    return `Evolução de categoria — ${monthPeriod(startDateKey.slice(0, 7)).label} a ${monthPeriod(endDateKey.slice(0, 7)).label}`;
  },

  toBlocks(data): ReportBlock[] {
    const tableRows = data.months.map((point) => {
      const row: Record<string, string> = { month: point.label };
      for (const category of data.categories) row[category.id] = formatBRL(Math.abs(point.byCategoryCents[category.id] ?? 0));
      return row;
    });

    return [
      {
        kind: "table",
        title: "Gasto por mês",
        columns: [{ key: "month", label: "Mês" }, ...data.categories.map((c) => ({ key: c.id, label: c.name, align: "right" as const }))],
        rows: tableRows,
        emptyText: "Nenhuma categoria selecionada.",
      },
      {
        kind: "list",
        title: "Lançamentos no período",
        rows: data.transactions.map((t) => ({ label: t.description, sublabel: t.occurredOn, value: formatBRL(t.amountCents), tone: t.amountCents < 0 ? "red" : "emerald" })),
        emptyText: "Nenhum lançamento nessas categorias no período.",
      },
    ];
  },
};
