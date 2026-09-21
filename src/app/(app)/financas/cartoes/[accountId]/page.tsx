import { notFound, redirect } from "next/navigation";
import { CardStatementWorkspace } from "@/features/financas/components/card-statement-workspace";
import { getAccountBalanceCents, isFinanceOnboardingCompleted, listAccounts, listCardStatementTotals, listCardStatements } from "@/features/financas/queries";
import { requireOwner } from "@/lib/auth";

/** `/financas/cartoes/[accountId]` (4.7) — fatura atual, próximas, anteriores; limite usado/disponível; pagar fatura. */
export default async function CardStatementPage(props: PageProps<"/financas/cartoes/[accountId]">) {
  const { accountId } = await props.params;
  const { supabase, user } = await requireOwner();

  const completed = await isFinanceOnboardingCompleted(supabase, user.id);
  if (!completed) redirect("/financas/configurar");

  const accounts = await listAccounts(supabase);
  const account = accounts.find((a) => a.id === accountId);
  if (!account || account.kind !== "credit_card") notFound();

  const [statements, totalsMap, balanceCents] = await Promise.all([
    listCardStatements(supabase, accountId),
    listCardStatementTotals(supabase, accountId),
    getAccountBalanceCents(supabase, accountId),
  ]);

  return (
    <CardStatementWorkspace
      account={account}
      otherAccounts={accounts.filter((a) => a.id !== accountId)}
      statements={statements}
      statementTotals={Object.fromEntries(totalsMap)}
      balanceCents={balanceCents}
    />
  );
}
