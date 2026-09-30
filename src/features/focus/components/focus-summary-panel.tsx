import Link from "next/link";
import { formatFocusDuration } from "../lib/focus-summary";
import type { FocusSummary } from "../lib/focus-summary";

/** "Onde foi meu tempo" (10.3) — resumo da semana por tarefa/projeto, aba Foco de `/rotina`. */
export function FocusSummaryPanel({ summary }: { summary: FocusSummary }) {
  if (summary.byItem.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nenhuma sessão de foco essa semana ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{formatFocusDuration(summary.totalMinutes)} de foco essa semana.</p>
      <ul className="flex flex-col gap-1">
        {summary.byItem.map((entry) => (
          <li
            key={entry.itemId ?? "sem-tarefa"}
            className="flex items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]"
          >
            {entry.itemId ? (
              <Link href={`/itens/${entry.itemId}`} className="truncate text-black hover:underline dark:text-zinc-50">
                {entry.itemTitle}
              </Link>
            ) : (
              <span className="truncate text-zinc-500 dark:text-zinc-400">{entry.itemTitle}</span>
            )}
            <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{formatFocusDuration(entry.minutes)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
