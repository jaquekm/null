import type { AutomationRunRow } from "../queries";

const STATUS_LABELS: Record<string, string> = { success: "Sucesso", skipped: "Pulada", failed: "Falhou" };
const STATUS_CLASSES: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  skipped: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

/** "Histórico de execuções com detalhes de falha" (5.3). */
export function RunHistory({ runs }: { runs: AutomationRunRow[] }) {
  if (runs.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Ainda não rodou.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {runs.map((run) => {
        const detail = (run.detail as { error?: string; reason?: string } | null) ?? null;
        return (
          <li key={run.id} className="flex flex-col gap-1 rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.08]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-700 dark:text-zinc-200">{run.itemTitle ?? "(sem item)"}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[run.status] ?? ""}`}>{STATUS_LABELS[run.status] ?? run.status}</span>
            </div>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{new Date(run.createdAt).toLocaleString("pt-BR")}</span>
            {run.status === "failed" && detail?.error && <span className="text-xs text-red-600 dark:text-red-400">{detail.error}</span>}
            {run.status === "skipped" && detail?.reason && <span className="text-xs text-zinc-500 dark:text-zinc-400">Motivo: {detail.reason}</span>}
          </li>
        );
      })}
    </ul>
  );
}
