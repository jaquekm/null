"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteReportDefinitionAction, generateReportNow, saveReportDefinition, type ReportDefinitionRow } from "../actions";
import { parseReportSchedule, REPORT_SCHEDULE_PRESET_LABELS } from "../lib/schedule-presets";
import { REPORT_KIND_LABELS } from "../schemas";

const CHANNEL_ABBR: Record<string, string> = { push: "Push", email: "E-mail", whatsapp: "WhatsApp" };

/** Lista de definições salvas (prontas com agendamento + personalizadas, 6.4) — `/relatorios`. */
export function ReportDefinitionsList({ definitions }: { definitions: ReportDefinitionRow[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleGenerateNow(id: string) {
    startTransition(async () => {
      const result = await generateReportNow({ definitionId: id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Gerando relatório — você recebe um aviso quando estiver pronto.");
    });
  }

  function handleToggleEnabled(def: ReportDefinitionRow) {
    startTransition(async () => {
      const result = await saveReportDefinition(def.id, {
        name: def.name,
        kind: def.kind,
        params: def.params,
        scheduleRrule: def.scheduleRrule,
        deliverTo: def.deliverTo,
        channels: def.channels,
        includeAiSummary: def.includeAiSummary,
        enabled: !def.enabled,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteReportDefinitionAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Relatório excluído.");
      router.refresh();
    });
  }

  if (definitions.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma definição salva ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {definitions.map((def) => (
        <div key={def.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.08]">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-black dark:text-zinc-50">{def.name}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {REPORT_KIND_LABELS[def.kind]} · {REPORT_SCHEDULE_PRESET_LABELS[parseReportSchedule(def.scheduleRrule).kind]} ·{" "}
              {def.channels.map((c) => CHANNEL_ABBR[c] ?? c).join(", ")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => handleGenerateNow(def.id)} disabled={pending} className="rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]">
              Gerar agora
            </button>
            <button type="button" onClick={() => handleToggleEnabled(def)} disabled={pending} className="rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]">
              {def.enabled ? "Pausar" : "Ativar"}
            </button>
            <button type="button" onClick={() => handleDelete(def.id)} disabled={pending} className="rounded-full border border-black/[.12] px-3 py-1 text-xs text-red-600 dark:border-white/[.16] dark:text-red-400">
              Excluir
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
