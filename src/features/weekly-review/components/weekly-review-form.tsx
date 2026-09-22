"use client";

import { useActionState } from "react";
import type { Result } from "@/lib/result";
import { saveWeeklyReview } from "../actions";

const initialState: Result<{ id: string }> = { ok: true, data: { id: "" } };

const inputClassName =
  "w-full rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

/** Passo 6 (notas livres) + "Concluir revisão" (5.8) — os outros 5 passos são só leitura, renderizados pela página. */
export function WeeklyReviewForm() {
  const [state, formAction, pending] = useActionState(saveWeeklyReview, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <textarea
        name="notes"
        rows={4}
        placeholder="Notas livres da semana…"
        className={inputClassName}
      />
      {!state.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background self-start rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Concluir revisão"}
      </button>
    </form>
  );
}
