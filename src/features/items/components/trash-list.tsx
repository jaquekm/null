"use client";

import { useState, useTransition } from "react";
import { permanentlyDeleteItem, restoreItem } from "../actions";
import type { TrashedItemRow } from "../queries";

export function TrashList({ items }: { items: TrashedItemRow[] }) {
  const [visible, setVisible] = useState(items);
  const [pending, startTransition] = useTransition();

  function handleRestore(id: string) {
    startTransition(async () => {
      const result = await restoreItem(id);
      if (result.ok) setVisible((current) => current.filter((i) => i.id !== id));
    });
  }

  function handlePermanentDelete(id: string) {
    if (!window.confirm("Excluir definitivamente? Não é possível desfazer.")) return;
    startTransition(async () => {
      const result = await permanentlyDeleteItem(id);
      if (result.ok) setVisible((current) => current.filter((i) => i.id !== id));
    });
  }

  if (visible.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">A lixeira está vazia.</p>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {visible.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-2 rounded-lg border border-black/[.08] px-4 py-2.5 text-sm dark:border-white/[.08]"
        >
          <div className="min-w-0">
            <p className="truncate text-black dark:text-zinc-50">{item.title || "Sem título"}</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Excluído em {new Date(item.deletedAt).toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => handleRestore(item.id)}
              className="rounded-lg border border-black/[.12] px-3 py-1.5 text-xs text-zinc-700 hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]"
            >
              Restaurar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handlePermanentDelete(item.id)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Excluir definitivamente
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
