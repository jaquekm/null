"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { exportAllNow } from "../actions";

/** Botão "Exportar tudo" (7.4) — enfileira o job e avisa que o link chega por push; não baixa nada na hora (o zip pode demorar). */
export function ExportAllButton() {
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  function handleClick() {
    setPending(true);
    startTransition(async () => {
      const result = await exportAllNow();
      setPending(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Export iniciado — você recebe um aviso com o link de download quando estiver pronto.");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="w-fit rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
    >
      {pending ? "Iniciando..." : "Exportar tudo"}
    </button>
  );
}
