import { formatInTimeZone } from "date-fns-tz";
import { redirect } from "next/navigation";
import { listContacts } from "@/features/contacts/queries";
import { RecurringWorkspace } from "@/features/financas/components/recurring-workspace";
import { getUserTimezone, isFinanceOnboardingCompleted, listAccounts, listCategories, listRecurring } from "@/features/financas/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

/** `/financas/recorrencias` (4.8) — CRUD de `fin_recurring`, fonte do job `generate_bills`. */
export default async function RecorrenciasPage() {
  const { supabase, user } = await requireOwner();

  const completed = await isFinanceOnboardingCompleted(supabase, user.id);
  if (!completed) redirect("/financas/configurar");

  const timezone = await getUserTimezone(supabase, user.id);
  const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

  const [accounts, categories, spaces, contacts, recurring] = await Promise.all([
    listAccounts(supabase),
    listCategories(supabase),
    listActiveSpaces(supabase),
    listContacts(supabase, {}),
    listRecurring(supabase),
  ]);

  return <RecurringWorkspace recurring={recurring} accounts={accounts} categories={categories} spaces={spaces} contacts={contacts} defaultAnchorDate={today} />;
}
