"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setFinanceContactsIndexing } from "@/features/settings/actions";

/** "Finanças e contatos não são indexados por padrão" (6.5) — mesmo padrão de `AutoOcrToggle`. */
export function FinanceContactsToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function handleChange(checked: boolean) {
    setEnabled(checked);
    startTransition(async () => {
      const result = await setFinanceContactsIndexing(checked);
      if (!result.ok) {
        setEnabled(!checked);
        toast.error(result.error);
      }
    });
  }

  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.08]">
      <div>
        <p className="font-medium text-black dark:text-zinc-50">Indexar finanças e contatos</p>
        <p className="text-zinc-500 dark:text-zinc-400">
          Desligado por padrão: campos de contato e de valor monetário das propriedades de um item não entram no
          texto indexado pra busca semântica/IA. Ligue se quiser que esses dados sejam pesquisáveis por lá.
        </p>
      </div>
      <input type="checkbox" checked={enabled} disabled={pending} onChange={(e) => handleChange(e.target.checked)} aria-label="Indexar finanças e contatos" className="shrink-0" />
    </label>
  );
}
