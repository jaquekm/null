import { redirect } from "next/navigation";
import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { isFinanceOnboardingCompleted } from "@/features/financas/queries";
import { requireOwner } from "@/lib/auth";

export default async function FinancasPage() {
  const { supabase, user } = await requireOwner();

  const completed = await isFinanceOnboardingCompleted(supabase, user.id);
  if (!completed) redirect("/financas/configurar");

  return <PlaceholderPage title="Finanças" />;
}
