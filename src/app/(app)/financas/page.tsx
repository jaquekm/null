import { formatInTimeZone } from "date-fns-tz";
import { redirect } from "next/navigation";
import { DashboardWorkspace } from "@/features/financas/components/dashboard-workspace";
import { getDashboardData, getUserTimezone, isFinanceOnboardingCompleted, listCategories } from "@/features/financas/queries";
import { monthPeriod } from "@/features/financas/lib/period-range";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

/**
 * `/financas` (4.12) — painel: cards, fluxo de caixa, categorias, próximos
 * 30 dias, maiores gastos, sem categoria. A montagem de verdade mora em
 * `getDashboardData` (`queries.ts`) — chamada direto daqui com o `supabase`
 * que `requireOwner()` já devolveu, sem duplicar as ~100 linhas de
 * agregação (diferente do resto das páginas de finanças, que preferem
 * repetir a query+função pura em vez de chamar a `action`; aqui a lógica é
 * grande o bastante pra duplicar virar risco de verdade — ver PROGRESSO.md).
 */
export default async function FinancasPage() {
  const { supabase, user } = await requireOwner();

  const completed = await isFinanceOnboardingCompleted(supabase, user.id);
  if (!completed) redirect("/financas/configurar");

  const timezone = await getUserTimezone(supabase, user.id);
  const month = formatInTimeZone(new Date(), timezone, "yyyy-MM");
  const period = monthPeriod(month);

  const [spaces, categories, data] = await Promise.all([listActiveSpaces(supabase), listCategories(supabase), getDashboardData(supabase, user.id, { month })]);

  return <DashboardWorkspace spaces={spaces} categories={categories} initialMonth={period.month} initialData={data} />;
}
