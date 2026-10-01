import { formatInTimeZone } from "date-fns-tz";
import { redirect } from "next/navigation";
import { getUserTimezone, isFinanceOnboardingCompleted } from "@/features/financas/queries";
import { PatrimonioWorkspace } from "@/features/patrimonio/components/patrimonio-workspace";
import { getNetWorthData } from "@/features/patrimonio/queries";
import { requireOwner } from "@/lib/auth";

/** `/financas/patrimonio` (10.12) — investimentos e dívidas no mesmo painel, evolução mês a mês. */
export default async function PatrimonioPage() {
  const { supabase, user } = await requireOwner();

  const completed = await isFinanceOnboardingCompleted(supabase, user.id);
  if (!completed) redirect("/financas/configurar");

  const timezone = await getUserTimezone(supabase, user.id);
  const month = formatInTimeZone(new Date(), timezone, "yyyy-MM");

  const data = await getNetWorthData(supabase, user.id, month);

  return <PatrimonioWorkspace initial={data} month={month} />;
}
