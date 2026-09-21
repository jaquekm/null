import { redirect } from "next/navigation";
import { ImportWorkspace } from "@/features/financas/components/import-workspace";
import { isFinanceOnboardingCompleted, listAccounts, listCategories, listRecentImports } from "@/features/financas/queries";
import { requireOwner } from "@/lib/auth";

/** `/financas/importar` (4.5) — importar extrato OFX/CSV, com pré-visualização e desfazer. */
export default async function ImportarPage() {
  const { supabase, user } = await requireOwner();

  const completed = await isFinanceOnboardingCompleted(supabase, user.id);
  if (!completed) redirect("/financas/configurar");

  const [accounts, categories, imports] = await Promise.all([listAccounts(supabase), listCategories(supabase), listRecentImports(supabase)]);

  return <ImportWorkspace accounts={accounts} categories={categories} imports={imports} />;
}
