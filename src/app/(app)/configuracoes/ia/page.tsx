import { startOfMonth } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { FinanceContactsToggle } from "@/features/ai/components/finance-contacts-toggle";
import { ReindexAllButton } from "@/features/ai/components/reindex-all-button";
import { SpaceAiToggleList, type SpaceAiRow } from "@/features/ai/components/space-ai-toggle-list";
import { estimateReindexCost } from "@/features/ai/queries";
import { isFinanceContactsIndexingEnabled } from "@/features/settings/queries";
import { aggregateUsage } from "@/features/usage/lib/aggregate-usage";
import { listUsageEventsSince } from "@/features/usage/queries";
import { requireOwner } from "@/lib/auth";

function formatUsd(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
}

/** Contrato de privacidade + reindexação (6.5): quais espaços são indexados, se finanças/contatos entram, custo do mês e "Reindexar tudo". */
export default async function IaSettingsPage() {
  const { supabase, user } = await requireOwner();

  const { data: settings } = await supabase.from("user_settings").select("timezone").eq("owner_id", user.id).maybeSingle();
  const timezone = settings?.timezone ?? "America/Sao_Paulo";
  const now = new Date();
  const monthStartUtc = fromZonedTime(startOfMonth(toZonedTime(now, timezone)), timezone);

  const [{ data: spaceRows }, financeContactsEnabled, estimate, usageRows] = await Promise.all([
    supabase.from("spaces").select("id, name, icon, ai_enabled").is("archived_at", null).order("position", { ascending: true }),
    isFinanceContactsIndexingEnabled(supabase, user.id),
    estimateReindexCost(supabase, user.id),
    listUsageEventsSince(supabase, monthStartUtc),
  ]);

  const spaces: SpaceAiRow[] = (spaceRows ?? []).map((row) => ({ id: row.id, name: row.name, icon: row.icon, aiEnabled: row.ai_enabled }));
  const usageSummary = aggregateUsage(usageRows, timezone, monthStartUtc, now);
  const embeddingsCostThisMonth = usageSummary.byProvider.find((entry) => entry.key === "embeddings")?.usd ?? 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">IA</h1>
        <p className="text-sm text-black/60 dark:text-white/60">Indexação pra busca semântica e o que é enviado a provedores de IA.</p>
      </div>

      <div className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Custo de indexação neste mês</span>
          <span className="text-lg font-semibold text-black dark:text-zinc-50">{formatUsd(embeddingsCostThisMonth)}</span>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">Espaços indexados</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Só itens de espaços com IA ligada entram na busca semântica e em &quot;Perguntar à base&quot;.
        </p>
        <SpaceAiToggleList spaces={spaces} />
      </section>

      <section>
        <FinanceContactsToggle initialEnabled={financeContactsEnabled} />
      </section>

      <section className="flex flex-col gap-2 border-t border-black/[.08] pt-4 dark:border-white/[.08]">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">Reindexação</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Necessária ao trocar de modelo de embeddings ou depois de mudar os toggles acima.</p>
        <ReindexAllButton estimate={estimate} />
      </section>
    </div>
  );
}
