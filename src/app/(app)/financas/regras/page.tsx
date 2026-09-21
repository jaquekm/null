import { redirect } from "next/navigation";
import { listContacts } from "@/features/contacts/queries";
import { RulesWorkspace } from "@/features/financas/components/rules-workspace";
import { isFinanceOnboardingCompleted, listAccounts, listCategories, listRules } from "@/features/financas/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

/** `/financas/regras` (4.6) — regras de categorização automática. */
export default async function RegrasPage() {
  const { supabase, user } = await requireOwner();

  const completed = await isFinanceOnboardingCompleted(supabase, user.id);
  if (!completed) redirect("/financas/configurar");

  const [rules, accounts, categories, contacts, spaces] = await Promise.all([
    listRules(supabase),
    listAccounts(supabase),
    listCategories(supabase),
    listContacts(supabase, {}),
    listActiveSpaces(supabase),
  ]);

  return <RulesWorkspace rules={rules} accounts={accounts} categories={categories} contacts={contacts} spaces={spaces} />;
}
