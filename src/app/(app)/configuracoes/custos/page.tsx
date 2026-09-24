import { startOfMonth } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { BalanceChart } from "@/features/costs/components/balance-chart";
import { HubCostsSection } from "@/features/costs/components/hub-costs-section";
import { SubscriptionsSection } from "@/features/costs/components/subscriptions-section";
import { computeMonthlyBalanceSeries } from "@/features/costs/lib/monthly-balance";
import { listHubCostsSince, listSubscriptions } from "@/features/costs/queries";
import { shiftMonth } from "@/features/financas/lib/period-range";
import { aggregateUsage } from "@/features/usage/lib/aggregate-usage";
import { listUsageEventsSince } from "@/features/usage/queries";
import { requireOwner } from "@/lib/auth";

function formatUsd(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
}

export default async function CustosPage() {
  const { supabase, user } = await requireOwner();

  const { data: settings } = await supabase.from("user_settings").select("timezone").eq("owner_id", user.id).maybeSingle();
  const timezone = settings?.timezone ?? "America/Sao_Paulo";

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(currentMonth, i - 11));

  const [subscriptions, hubCosts] = await Promise.all([listSubscriptions(supabase), listHubCostsSince(supabase, `${months[0]}-01`)]);

  const balanceSeries = computeMonthlyBalanceSeries(subscriptions, hubCosts, months);

  const monthStartUtc = fromZonedTime(startOfMonth(toZonedTime(now, timezone)), timezone);
  const usageRows = await listUsageEventsSince(supabase, monthStartUtc);
  const usageSummary = aggregateUsage(usageRows, timezone, monthStartUtc, now);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Custos e economia</h1>
        <p className="text-sm text-black/60 dark:text-white/60">Quanto o Hub substitui, quanto ele custa e o saldo entre os dois.</p>
      </div>

      <SubscriptionsSection subscriptions={subscriptions} />

      <HubCostsSection costs={hubCosts} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">Saldo (últimos 12 meses)</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Só em reais — economia de assinaturas canceladas menos custos fixos do Hub. O custo variável de IA/uso (
          {formatUsd(usageSummary.totalUsd)} neste mês) é cobrado em dólar e fica de fora deste gráfico; veja o detalhe em{" "}
          <a href="/configuracoes/uso" className="underline">
            Uso e custo
          </a>
          .
        </p>
        <BalanceChart data={balanceSeries} />
      </section>
    </div>
  );
}
