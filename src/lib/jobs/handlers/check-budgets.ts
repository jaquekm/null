import { formatInTimeZone } from "date-fns-tz";
import { thresholdsReached } from "@/features/financas/lib/budget-progress";
import { monthPeriod } from "@/features/financas/lib/period-range";
import { getUserTimezone } from "@/features/reminders/queries";
import { notifyOwner } from "@/lib/messaging/notify-owner";
import { formatBRL } from "@/lib/money";
import type { JobHandler } from "../types";

/**
 * Job `check_budgets` (4.11, diário): soma o gasto do mês por categoria de
 * despesa com orçamento definido e notifica o dono (push) ao cruzar 80%/100%
 * — uma vez cada por categoria/mês. `fin_budget_alerts` tem índice único
 * (`category_id, month, threshold`); o próprio banco garante o "uma vez
 * cada" (insert cai em 23505, tratado como "já notificado", não como erro
 * — mesmo padrão do índice único de `generate_bills`).
 */
export const checkBudgets: JobHandler = async (job, { supabase }) => {
  const timezone = await getUserTimezone(supabase, job.owner_id);
  const period = monthPeriod(formatInTimeZone(new Date(), timezone, "yyyy-MM"));

  const { data: categories, error: categoriesError } = await supabase
    .from("fin_categories")
    .select("id, name, monthly_budget_cents")
    .eq("owner_id", job.owner_id)
    .eq("kind", "expense")
    .is("archived_at", null)
    .not("monthly_budget_cents", "is", null);
  if (categoriesError) return { status: "retry", error: categoriesError.message };
  if (!categories || categories.length === 0) return { status: "done", result: { checked: 0, notified: 0 } };

  const { data: transactions, error: transactionsError } = await supabase
    .from("fin_transactions")
    .select("category_id, amount_cents")
    .eq("owner_id", job.owner_id)
    .eq("kind", "normal")
    .lt("amount_cents", 0)
    .not("category_id", "is", null)
    .gte("occurred_on", period.start)
    .lte("occurred_on", period.end);
  if (transactionsError) return { status: "retry", error: transactionsError.message };

  const spentByCategory = new Map<string, number>();
  for (const t of transactions ?? []) {
    const categoryId = t.category_id as string;
    spentByCategory.set(categoryId, (spentByCategory.get(categoryId) ?? 0) + Math.abs(t.amount_cents));
  }

  let notified = 0;
  const errors: string[] = [];

  for (const category of categories) {
    const budgetCents = category.monthly_budget_cents;
    if (!budgetCents || budgetCents <= 0) continue;

    const spentCents = spentByCategory.get(category.id) ?? 0;
    const percent = (spentCents / budgetCents) * 100;

    for (const threshold of thresholdsReached(percent)) {
      const { error: insertError } = await supabase
        .from("fin_budget_alerts")
        .insert({ owner_id: job.owner_id, category_id: category.id, month: period.start, threshold });
      if (insertError) {
        if (insertError.code === "23505") continue; // já notificado esse limite nesse mês
        errors.push(insertError.message);
        continue;
      }

      notified += 1;
      await notifyOwner(job.owner_id, {
        title: threshold >= 100 ? "Orçamento estourado" : "Orçamento quase no limite",
        text: `${category.name}: ${Math.round(percent)}% do orçamento de ${period.label} (${formatBRL(spentCents)} de ${formatBRL(budgetCents)}).`,
      });
    }
  }

  if (errors.length > 0) return { status: "retry", error: errors.join("; ") };
  return { status: "done", result: { checked: categories.length, notified } };
};
