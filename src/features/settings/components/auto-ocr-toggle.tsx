"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setAutoOcr } from "../actions";

export function AutoOcrToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function handleChange(checked: boolean) {
    setEnabled(checked);
    startTransition(async () => {
      const result = await setAutoOcr(checked);
      if (!result.ok) {
        setEnabled(!checked);
        toast.error(result.error);
      }
    });
  }

  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.08]">
      <div>
        <p className="font-medium text-black dark:text-zinc-50">OCR automático</p>
        <p className="text-zinc-500 dark:text-zinc-400">
          Ao enviar imagens ou PDFs escaneados, extrair o texto com IA automaticamente. Desligado, só o botão
          &quot;Extrair novamente&quot; no anexo roda o OCR.
        </p>
      </div>
      <input
        type="checkbox"
        checked={enabled}
        disabled={pending}
        onChange={(e) => handleChange(e.target.checked)}
        aria-label="OCR automático"
        className="shrink-0"
      />
    </label>
  );
}
