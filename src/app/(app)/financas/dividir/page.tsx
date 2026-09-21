import { formatInTimeZone } from "date-fns-tz";
import { redirect } from "next/navigation";
import { listContacts } from "@/features/contacts/queries";
import { SplitsWorkspace } from "@/features/financas/components/splits-workspace";
import {
  getUserTimezone,
  isFinanceOnboardingCompleted,
  listAccounts,
  listCategories,
  listContactBalances,
  listSplitGroupLabels,
  listSplits,
  listUnlinkedExpenseTransactions,
} from "@/features/financas/queries";
import { requireOwner } from "@/lib/auth";

/** `/financas/dividir` (4.9) — divisões abertas, saldos por pessoa, histórico e visão de acerto por grupo. */
export default async function DividirPage() {
  const { supabase, user } = await requireOwner();

  const completed = await isFinanceOnboardingCompleted(supabase, user.id);
  if (!completed) redirect("/financas/configurar");

  const timezone = await getUserTimezone(supabase, user.id);
  const now = new Date();
  const today = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const since = formatInTimeZone(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), timezone, "yyyy-MM-dd");

  const [accounts, categories, contacts, splits, balances, groupLabels, linkableTransactions] = await Promise.all([
    listAccounts(supabase),
    listCategories(supabase),
    listContacts(supabase, {}),
    listSplits(supabase, { status: "open" }),
    listContactBalances(supabase),
    listSplitGroupLabels(supabase),
    listUnlinkedExpenseTransactions(supabase, since),
  ]);

  return (
    <SplitsWorkspace
      accounts={accounts}
      categories={categories}
      contacts={contacts}
      linkableTransactions={linkableTransactions}
      groupLabels={groupLabels}
      defaultOccurredOn={today}
      initialSplits={splits}
      initialBalances={[...balances.entries()].map(([contactId, balanceCents]) => ({ contactId, balanceCents }))}
    />
  );
}
