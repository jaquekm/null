import { formatInTimeZone } from "date-fns-tz";
import { redirect } from "next/navigation";
import { listContacts } from "@/features/contacts/queries";
import { LancamentosWorkspace } from "@/features/financas/components/lancamentos-workspace";
import { monthPeriod } from "@/features/financas/lib/period-range";
import { computeTransactionTotals } from "@/features/financas/lib/transaction-totals";
import { getUserTimezone, isFinanceOnboardingCompleted, listAccounts, listCategories, listTransactions } from "@/features/financas/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

/** `/financas/lancamentos` (4.4) — tabela de lançamentos do mês, com filtros e totais. */
export default async function LancamentosPage() {
  const { supabase, user } = await requireOwner();

  const completed = await isFinanceOnboardingCompleted(supabase, user.id);
  if (!completed) redirect("/financas/configurar");

  const timezone = await getUserTimezone(supabase, user.id);
  const period = monthPeriod(formatInTimeZone(new Date(), timezone, "yyyy-MM"));

  const [accounts, categories, spaces, contacts, rows] = await Promise.all([
    listAccounts(supabase),
    listCategories(supabase),
    listActiveSpaces(supabase),
    listContacts(supabase, {}),
    listTransactions(supabase, { periodStart: period.start, periodEnd: period.end }),
  ]);

  return (
    <LancamentosWorkspace
      accounts={accounts}
      categories={categories}
      spaces={spaces}
      contacts={contacts}
      initialMonth={period.month}
      initialRows={rows}
      initialTotals={computeTransactionTotals(rows)}
    />
  );
}
