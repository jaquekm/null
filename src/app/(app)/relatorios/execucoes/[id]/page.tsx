import { notFound } from "next/navigation";
import { ReportRunActions } from "@/features/reports/components/report-run-actions";
import { ReportRunView } from "@/features/reports/components/report-run-view";
import { getReportRun } from "@/features/reports/queries";
import { requireOwner } from "@/lib/auth";

/** Tela de uma execução de relatório (6.4) — versão web do snapshot + Baixar PDF/Compartilhar/Enviar. `report_runs` tem RLS por `owner_id` (migration 6.1), então o cliente já vem escopado ao dono. */
export default async function ReportRunPage(props: PageProps<"/relatorios/execucoes/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireOwner();

  const run = await getReportRun(supabase, id);
  if (!run) notFound();

  const generatedAt = new Date(run.createdAt).toLocaleDateString("pt-BR");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <ReportRunActions reportRunId={run.id} pdfAttachmentId={run.pdfAttachmentId} />
      <ReportRunView kind={run.kind} title={run.title} subtitle={`Gerado em ${generatedAt}`} data={run.data} />
      {run.aiSummary && (
        <div className="rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.08]">
          <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Resumo por IA</p>
          <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{run.aiSummary}</p>
        </div>
      )}
    </div>
  );
}
