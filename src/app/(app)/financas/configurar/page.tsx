import { FinanceOnboarding } from "@/features/financas/components/finance-onboarding";
import { seedDefaultCategories } from "@/features/financas/actions";
import { isFinanceAiEnabled, listAccounts, listCategories, listPixKeys } from "@/features/financas/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

/** `/financas/configurar` (4.3) — primeiro acesso ao módulo: contas, categorias, Pix e IA. */
export default async function FinanceOnboardingPage() {
  const { supabase, user } = await requireOwner();

  let categories = await listCategories(supabase);
  if (categories.length === 0) {
    await seedDefaultCategories();
    categories = await listCategories(supabase);
  }

  const [accounts, pixKeys, spaces, aiEnabled] = await Promise.all([
    listAccounts(supabase),
    listPixKeys(supabase),
    listActiveSpaces(supabase),
    isFinanceAiEnabled(supabase, user.id),
  ]);

  return <FinanceOnboarding accounts={accounts} categories={categories} pixKeys={pixKeys} spaces={spaces} initialAiEnabled={aiEnabled} />;
}
