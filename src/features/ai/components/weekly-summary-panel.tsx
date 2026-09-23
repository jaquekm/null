"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { previewWeeklySummary } from "@/features/ai/actions";

/** "Resumo semanal" (6.8) — destaques da semana gerados sob demanda, sem gravar nada. */
export function WeeklySummaryPanel() {
  const [summary, setSummary] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const result = await previewWeeklySummary();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSummary(result.data);
    });
  }

  function handleCopy() {
    if (!summary) return;
    navigator.clipboard.writeText(summary).then(
      () => toast.success("Copiado."),
      () => toast.error("Não foi possível copiar."),
    );
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
      <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Destaques da semana (IA)</h2>
      {summary ? (
        <>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">{summary}</p>
          <div className="flex gap-2">
            <button type="button" onClick={handleCopy} className="self-start rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]">
              Copiar
            </button>
            <button type="button" onClick={handleGenerate} disabled={pending} className="self-start rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]">
              {pending ? "Gerando…" : "Gerar de novo"}
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={handleGenerate} disabled={pending} className="self-start rounded-full border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
          {pending ? "Gerando…" : "Gerar destaques com IA"}
        </button>
      )}
    </section>
  );
}
