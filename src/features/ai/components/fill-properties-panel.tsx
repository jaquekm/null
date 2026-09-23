"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyFilledProperties, previewFilledProperties } from "@/features/ai/actions";
import type { FillPropertiesSuggestion } from "@/features/ai/lib/fill-properties";

/**
 * "Preencher propriedades" (6.8): revisão com checkbox por campo (mantido
 * por padrão) antes de mesclar em `items.properties`. `PropertiesPanel` lê
 * `item.properties` direto da prop (sem estado local próprio, diferente do
 * editor de conteúdo) — `router.refresh()` já é suficiente pra ver os
 * valores aplicados, sem precisar de reload cheio.
 */
export function FillPropertiesPanel({ itemId }: { itemId: string }) {
  const [suggestions, setSuggestions] = useState<FillPropertiesSuggestion[] | null>(null);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleGenerate() {
    startTransition(async () => {
      const result = await previewFilledProperties(itemId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSuggestions(result.data);
      setChecked(result.data.map(() => true));
    });
  }

  function handleApply() {
    if (!suggestions) return;
    const values: Record<string, unknown> = {};
    suggestions.forEach((suggestion, index) => {
      if (checked[index]) values[suggestion.key] = suggestion.value;
    });
    if (Object.keys(values).length === 0) return;

    startTransition(async () => {
      const result = await applyFilledProperties(itemId, { values });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Propriedades preenchidas.");
      setSuggestions(null);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-2">
      {!suggestions ? (
        <button type="button" onClick={handleGenerate} disabled={pending} className="self-start rounded-full border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
          {pending ? "Buscando…" : "Preencher propriedades com IA"}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-black/[.08] p-3 dark:border-white/[.08]">
          <p className="text-sm font-medium text-black dark:text-zinc-50">Valores encontrados</p>
          <ul className="flex flex-col gap-1.5">
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked[index] ?? false}
                  onChange={(e) => setChecked((prev) => prev.map((value, i) => (i === index ? e.target.checked : value)))}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{suggestion.label}:</span> {suggestion.displayValue}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" onClick={handleApply} disabled={pending || checked.every((value) => !value)} className="rounded-full border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
              {pending ? "Aplicando…" : "Aplicar selecionados"}
            </button>
            <button type="button" onClick={() => setSuggestions(null)} disabled={pending} className="rounded-full border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
