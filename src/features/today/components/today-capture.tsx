"use client";

import { Plus } from "lucide-react";
import { useCaptureDialog } from "@/features/capture/components/capture-dialog-provider";

/** Caixa de captura no topo do "Hoje": abre o mesmo diálogo do botão "+" (nota, tarefa, ideia, lista…). */
export function TodayCapture() {
  const { open } = useCaptureDialog();
  return (
    <button
      type="button"
      onClick={() => open()}
      className="flex w-full items-center gap-3 rounded-2xl border border-black/[.06] bg-surface px-4 py-3.5 text-left text-zinc-500 shadow-sm transition-all hover:-translate-y-px hover:border-brand/40 hover:shadow-md dark:border-white/[.06] dark:text-zinc-400"
    >
      <span className="bg-brand text-brand-fg flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
        <Plus className="h-4 w-4" aria-hidden />
      </span>
      Anotar, criar lista, tarefa ou lembrete…
    </button>
  );
}
