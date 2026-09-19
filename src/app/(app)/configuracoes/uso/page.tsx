import { startOfMonth } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { DailyUsageChart } from "@/features/usage/components/daily-usage-chart";
import { aggregateUsage } from "@/features/usage/lib/aggregate-usage";
import { listUsageEventsSince } from "@/features/usage/queries";
import { requireOwner } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Claude (Anthropic)",
  transcription: "Transcrição",
  embeddings: "Embeddings",
  resend: "E-mail (Resend)",
  whatsapp: "WhatsApp",
};

const FEATURE_LABELS: Record<string, string> = {
  meeting_summary: "Resumo de reunião",
  ocr: "OCR de documento",
  transcription: "Transcrição",
};

function formatUsd(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
}

export default async function UsoPage() {
  const { supabase, user } = await requireOwner();

  const { data: settings } = await supabase.from("user_settings").select("timezone").eq("owner_id", user.id).maybeSingle();
  const timezone = settings?.timezone ?? "America/Sao_Paulo";

  const now = new Date();
  const monthStartUtc = fromZonedTime(startOfMonth(toZonedTime(now, timezone)), timezone);

  const rows = await listUsageEventsSince(supabase, monthStartUtc);
  const summary = aggregateUsage(rows, timezone, monthStartUtc, now);

  const budget = serverEnv.AI_MONTHLY_BUDGET_USD;
  const aiSpent = summary.byProvider.find((entry) => entry.key === "anthropic")?.usd ?? 0;
  const budgetPct = budget ? Math.min((aiSpent / budget) * 100, 100) : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Uso e custo</h1>
        <p className="text-sm text-black/60 dark:text-white/60">Gasto estimado com provedores externos neste mês.</p>
      </div>

      <div className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Total do mês</span>
          <span className="text-2xl font-semibold text-black dark:text-zinc-50">{formatUsd(summary.totalUsd)}</span>
        </div>

        {budget != null && (
          <div className="mt-3 flex flex-col gap-1">
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Orçamento de IA (Claude)</span>
              <span>
                {formatUsd(aiSpent)} de {formatUsd(budget)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.1]">
              <div
                className={`h-full rounded-full ${budgetPct! >= 100 ? "bg-red-500" : "bg-black/70 dark:bg-white/70"}`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-black dark:text-zinc-50">Por dia</h2>
        <DailyUsageChart daily={summary.daily} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium text-black dark:text-zinc-50">Por provedor</h2>
          {summary.byProvider.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum uso registrado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {summary.byProvider.map((entry) => (
                <li key={entry.key} className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-300">{PROVIDER_LABELS[entry.key] ?? entry.key}</span>
                  <span className="text-black dark:text-zinc-50">{formatUsd(entry.usd)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium text-black dark:text-zinc-50">Por recurso</h2>
          {summary.byFeature.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum uso registrado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {summary.byFeature.map((entry) => (
                <li key={entry.key} className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-300">{FEATURE_LABELS[entry.key] ?? entry.key}</span>
                  <span className="text-black dark:text-zinc-50">{formatUsd(entry.usd)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
