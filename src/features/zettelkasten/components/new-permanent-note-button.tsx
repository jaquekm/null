"use client";

import { NotebookPen } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { createPermanentNote } from "../actions";

/** "+ Nota permanente" (5.11) — cria com `id_zettel` gerado e leva direto pro item (`redirect` na própria action). */
export function NewPermanentNoteButton({ spaceId }: { spaceId: string | null }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await createPermanentNote(spaceId);
      // Se chegou aqui, a criação falhou — o caminho de sucesso faz `redirect()` (nunca retorna).
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-2 text-sm text-zinc-700 disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-200"
    >
      <NotebookPen className="h-4 w-4" />
      Nova nota permanente
    </button>
  );
}
