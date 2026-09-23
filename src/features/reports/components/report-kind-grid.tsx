"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateReportNow } from "../actions";
import { REPORT_KIND_LABELS, type ReportKind } from "../schemas";
import { ScheduleReportDialog } from "./schedule-report-dialog";

/** Relatórios prontos (6.2/6.2b) que a página `/relatorios` oferece pra gerar ou agendar — todo `reportKind` exceto `custom` (que tem seu próprio construtor, `/relatorios/novo`). */
const READY_KINDS = Object.keys(REPORT_KIND_LABELS).filter((kind) => kind !== "custom") as ReportKind[];

/** Cartões dos relatórios prontos (6.4) — "Gerar agora" enfileira `generate_report` ad hoc (sem definição, sem agendamento); "Agendar" abre o diálogo que cria uma `report_definitions` com recorrência. */
export function ReportKindGrid({ timezone }: { timezone: string }) {
  const [scheduling, setScheduling] = useState<ReportKind | null>(null);
  const [pendingKind, setPendingKind] = useState<ReportKind | null>(null);
  const [, startTransition] = useTransition();

  function handleGenerateNow(kind: ReportKind) {
    setPendingKind(kind);
    startTransition(async () => {
      const result = await generateReportNow({ kind, params: {} });
      setPendingKind(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Gerando relatório — você recebe um aviso quando estiver pronto.");
    });
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {READY_KINDS.map((kind) => (
          <div key={kind} className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
            <p className="text-sm font-medium text-black dark:text-zinc-50">{REPORT_KIND_LABELS[kind]}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleGenerateNow(kind)}
                disabled={pendingKind === kind}
                className="rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]"
              >
                {pendingKind === kind ? "Gerando..." : "Gerar agora"}
              </button>
              <button type="button" onClick={() => setScheduling(kind)} className="rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]">
                Agendar
              </button>
            </div>
          </div>
        ))}
      </div>
      {scheduling && <ScheduleReportDialog kind={scheduling} name={REPORT_KIND_LABELS[scheduling]} timezone={timezone} onClose={() => setScheduling(null)} />}
    </>
  );
}
