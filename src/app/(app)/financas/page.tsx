import { redirect } from "next/navigation";
import { isFinanceOnboardingCompleted } from "@/features/financas/queries";
import { requireOwner } from "@/lib/auth";

/**
 * `/financas` ainda não tem painel próprio (`fin_monthly_summary`/gráficos
 * são a 4.12) — enquanto isso, cai direto nos lançamentos (4.4), o único
 * módulo com funcionalidade real até aqui, em vez de mostrar "Em breve"
 * pra uma seção que já tem conteúdo de verdade atrás dela.
 */
export default async function FinancasPage() {
  const { supabase, user } = await requireOwner();

  const completed = await isFinanceOnboardingCompleted(supabase, user.id);
  if (!completed) redirect("/financas/configurar");

  redirect("/financas/lancamentos");
}
