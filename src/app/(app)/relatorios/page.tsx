import Link from "next/link";
import { getUserTimezone } from "@/features/reminders/queries";
import { REPORT_KIND_LABELS } from "@/features/reports/schemas";
import { ReportDefinitionsList } from "@/features/reports/components/report-definitions-list";
import { ReportKindGrid } from "@/features/reports/components/report-kind-grid";
import { ensureReportScheduleJob, listReportDefinitions, listReportRuns } from "@/features/reports/queries";
import { requireOwner } from "@/lib/auth";

export default async function RelatoriosPage() {
  const { supabase, user } = await requireOwner();

  // Garante o job periódico de agendamento (6.4) — mesmo padrão "garante na
  // primeira visita de verdade" do `check_reviews_due` (5.7): sem isso, o
  // dono que já concluiu o onboarding antes da 6.4 nunca ganharia a linha
  // de `job_schedules`, já que ela só pode ser criada com um `owner_id` real.
  await ensureReportScheduleJob(supabase, user.id);

  const [timezone, definitions, runs] = await Promise.all([
    getUserTimezone(supabase, user.id),
    listReportDefinitions(supabase),
    listReportRuns(supabase, 20),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Relatórios</h1>
        <Link href="/relatorios/novo" className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]">
          Novo relatório personalizado
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Relatórios prontos</h2>
        <ReportKindGrid timezone={timezone} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Definições salvas</h2>
        <ReportDefinitionsList definitions={definitions} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Histórico de execuções</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum relatório gerado ainda.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {runs.map((run) => (
              <Link
                key={run.id}
                href={`/relatorios/execucoes/${run.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[.08] p-3 text-sm hover:bg-black/[.02] dark:border-white/[.08] dark:hover:bg-white/[.04]"
              >
                <span className="text-black dark:text-zinc-50">{run.title}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {REPORT_KIND_LABELS[run.kind]} · {new Date(run.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
