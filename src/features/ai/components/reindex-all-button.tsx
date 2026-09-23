"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reindexAllItems } from "../actions";
import type { ReindexEstimate } from "../queries";

function formatUsd(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
}

/**
 * "Reindexar tudo" (6.5) — necessário ao trocar de modelo de embeddings.
 * Mostra a estimativa (contagem de itens + custo aproximado) antes de
 * confirmar, como o enunciado pede.
 */
export function ReindexAllButton({ estimate }: { estimate: ReindexEstimate }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await reindexAllItems();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.count} itens enfileirados pra reindexar.`);
      setOpen(false);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="self-start rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]">
        Reindexar tudo
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
          >
            <h2 className="mb-2 text-sm font-medium text-black dark:text-zinc-50">Reindexar tudo</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {estimate.itemCount} {estimate.itemCount === 1 ? "item será reindexado" : "itens serão reindexados"}.
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Custo estimado: {estimate.estimatedUsd != null ? formatUsd(estimate.estimatedUsd) : "desconhecido"} (aproximado, o chunking real pode variar).
            </p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Acompanhe o progresso em{" "}
              <Link href="/configuracoes/jobs" className="underline">
                Configurações → Jobs
              </Link>{" "}
              (tipo <code>index_item</code>).
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending || estimate.itemCount === 0}
                className="bg-foreground text-background rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-60"
              >
                {pending ? "Enfileirando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
