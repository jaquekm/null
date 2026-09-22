import { formatInTimeZone } from "date-fns-tz";
import { redirect } from "next/navigation";
import { listContacts } from "@/features/contacts/queries";
import { BillsWorkspace } from "@/features/financas/components/bills-workspace";
import { getUserTimezone, isFinanceOnboardingCompleted, listAccounts, listBills, listCategories } from "@/features/financas/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

/** `/financas/contas` (4.8) — contas a pagar/receber, por aba (a pagar/a receber/pagas/todas), agrupadas por vencimento. */
export default async function ContasPage() {
  const { supabase, user } = await requireOwner();

  const completed = await isFinanceOnboardingCompleted(supabase, user.id);
  if (!completed) redirect("/financas/configurar");

  const timezone = await getUserTimezone(supabase, user.id);
  const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

  const [accounts, categories, spaces, contacts, rows] = await Promise.all([
    listAccounts(supabase),
    listCategories(supabase),
    listActiveSpaces(supabase),
    listContacts(supabase, {}),
    listBills(supabase, { tab: "payable" }, today),
  ]);

  return <BillsWorkspace accounts={accounts} categories={categories} spaces={spaces} contacts={contacts} initialToday={today} initialRows={rows} />;
}
