"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAutomation, toggleAutomation } from "../actions";
import type { AutomationListRow } from "../queries";

/** Lista de `/configuracoes/automacoes` (5.3): ativar/desativar, última execução, contagem — cada automação como frase (9.8). */
export function AutomationList({ automations }: { automations: AutomationListRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleToggle(id: string, enabled: boolean) {
    setPendingId(id);
    startTransition(async () => {
      await toggleAutomation(id, enabled);
      router.refresh();
      setPendingId(null);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Excluir esta automação? O histórico de execuções também some.")) return;
    setPendingId(id);
    startTransition(async () => {
      await deleteAutomation(id);
      router.refresh();
      setPendingId(null);
    });
  }

  if (automations.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma automação sua ainda — comece por uma receita acima ou crie a sua.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {automations.map((automation) => (
        <li key={automation.id} className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/configuracoes/automacoes/${automation.id}`} className="min-w-0 flex-1">
              <p className="leading-snug text-black dark:text-zinc-50">{automation.sentence}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {automation.name}
                {automation.packKey && ` · pack: ${automation.packKey}`}
              </p>
              {automation.description && <p className="text-xs text-zinc-500 dark:text-zinc-400">{automation.description}</p>}
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={automation.enabled}
                  disabled={pendingId === automation.id}
                  onChange={(event) => handleToggle(automation.id, event.target.checked)}
                />
                Ativa
              </label>
              <button
                type="button"
                onClick={() => handleDelete(automation.id)}
                disabled={pendingId === automation.id}
                className="text-xs text-red-600 underline disabled:opacity-60 dark:text-red-400"
              >
                Excluir
              </button>
            </div>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {automation.runCount} execução(ões){automation.lastRunAt && ` · última em ${new Date(automation.lastRunAt).toLocaleString("pt-BR")}`}
          </p>
        </li>
      ))}
    </ul>
  );
}
