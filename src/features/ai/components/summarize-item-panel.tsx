"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { applyItemSummary, previewItemSummary } from "@/features/ai/actions";

/**
 * "Resumir" (6.8): gera os bullets pra revisão antes de aplicar — `Aplicar`
 * insere o bloco recolhível no topo do conteúdo (`applyItemSummary`). Depois
 * de aplicar, `window.location.reload()` em vez de `router.refresh()`: o
 * editor (`ItemContentEditor`, `useEditor({ content: initialContent })`) só
 * lê `initialContent` na montagem — mudar o conteúdo por fora (mesma
 * limitação de "Restaurar versão", já existente) não apareceria sem
 * remontar o componente de verdade.
 */
export function SummarizeItemPanel({ itemId }: { itemId: string }) {
  const [bullets, setBullets] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const result = await previewItemSummary(itemId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBullets(result.data.bullets);
    });
  }

  function handleApply() {
    if (!bullets) return;
    startTransition(async () => {
      const result = await applyItemSummary(itemId, { bullets });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <section className="flex flex-col gap-2">
      {!bullets ? (
        <button type="button" onClick={handleGenerate} disabled={pending} className="self-start rounded-full border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
          {pending ? "Gerando…" : "Resumir com IA"}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-black/[.08] p-3 dark:border-white/[.08]">
          <p className="text-sm font-medium text-black dark:text-zinc-50">Prévia do resumo</p>
          <ul className="list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {bullets.map((bullet, index) => (
              <li key={index}>{bullet}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" onClick={handleApply} disabled={pending} className="rounded-full border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
              {pending ? "Aplicando…" : "Aplicar"}
            </button>
            <button type="button" onClick={() => setBullets(null)} disabled={pending} className="rounded-full border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
