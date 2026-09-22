import Link from "next/link";
import { getUserTimezone } from "@/features/reminders/queries";
import { getSalesDashboardData, getSalesTypeIds, OPPORTUNITY_STAGE_ORDER } from "@/features/sales/queries";
import { formatBRL } from "@/lib/money";
import { requireOwner } from "@/lib/auth";

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualificado: "Qualificado",
  proposta_enviada: "Proposta enviada",
  negociacao: "Negociação",
  ganho: "Ganho",
};

export default async function VendasPage() {
  const { supabase, user } = await requireOwner();
  const typeIds = await getSalesTypeIds(supabase);

  if (!typeIds) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Vendas</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          O pack &quot;Vendas (CRM)&quot; ainda não está instalado. Instale em{" "}
          <Link href="/configuracoes/metodos" className="text-black underline dark:text-zinc-50">
            Configurações → Métodos
          </Link>{" "}
          pra ver o funil e o painel aqui.
        </p>
      </div>
    );
  }

  const timezone = await getUserTimezone(supabase, user.id);
  const data = await getSalesDashboardData(supabase, typeIds.opportunityTypeId, timezone);
  const maxReached = Math.max(1, ...data.conversionFunnel.map((step) => step.reachedCount));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Vendas</h1>
        <Link href="/espacos" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          Ver oportunidades →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Em aberto no funil" value={formatBRL(data.openValueCents)} sub={`${data.openCount} oportunidades`} />
        <StatCard label="Previsão ponderada do mês" value={formatBRL(data.weightedForecastCents)} sub="valor × probabilidade" />
        <StatCard label="Ganhas" value={formatBRL(data.wonValueCents)} sub={`${data.wonCount} oportunidades`} />
        <StatCard label="Perdidas" value={String(data.lostCount)} sub="oportunidades" />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">Funil de conversão</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Quantas oportunidades já passaram por cada etapa (histórico de versões) e a taxa de conversão pra próxima.
        </p>
        <div className="flex flex-col gap-1.5">
          {data.conversionFunnel.map((step) => (
            <div key={step.stage} className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0 text-zinc-600 dark:text-zinc-300">{STAGE_LABELS[step.stage] ?? step.stage}</span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-black/[.04] dark:bg-white/[.06]">
                <div className="h-full rounded bg-black/70 dark:bg-white/70" style={{ width: `${(step.reachedCount / maxReached) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-zinc-500 dark:text-zinc-400">{step.reachedCount}</span>
              <span className="w-14 shrink-0 text-right text-xs text-zinc-400 dark:text-zinc-500">
                {step.conversionToNextPercent != null ? `${step.conversionToNextPercent}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">Tempo médio por etapa</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OPPORTUNITY_STAGE_ORDER.map((stage) => (
            <div key={stage} className="rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
              <p className="text-zinc-500 dark:text-zinc-400">{STAGE_LABELS[stage] ?? stage}</p>
              <p className="font-medium text-black dark:text-zinc-50">
                {data.avgDurationDaysByStage[stage] != null ? `${data.avgDurationDaysByStage[stage]} dias` : "—"}
              </p>
            </div>
          ))}
        </div>
      </section>

      {data.lostByReason.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Perdidas por motivo</h2>
          <ul className="flex flex-col gap-1">
            {data.lostByReason.map((row) => (
              <li key={row.reason} className="flex items-center justify-between rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
                <span className="text-zinc-600 dark:text-zinc-300">{row.reason}</span>
                <span className="font-medium text-black dark:text-zinc-50">{row.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-lg font-semibold text-black dark:text-zinc-50">{value}</p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500">{sub}</p>
    </div>
  );
}
