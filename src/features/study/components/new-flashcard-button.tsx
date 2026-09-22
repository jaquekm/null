"use client";

import { Plus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createFlashcard, searchDeckCandidates } from "../actions";
import type { DeckCandidate } from "../queries";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

/** "+ Novo flashcard" (5.7) — cria o item e o `review_cards` junto (`createFlashcard`, ver `lib/create-flashcard.ts`). */
export function NewFlashcardButton({ spaceId }: { spaceId: string | null }) {
  const [open, setOpen] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [deckItemId, setDeckItemId] = useState("");
  const [decks, setDecks] = useState<DeckCandidate[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => setDecks(await searchDeckCandidates()));
  }, [open]);

  function resetForm() {
    setFront("");
    setBack("");
    setDeckItemId("");
  }

  function handleSubmit(again: boolean) {
    startTransition(async () => {
      const result = await createFlashcard({ spaceId, deckItemId: deckItemId || null, front, back });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Flashcard criado.");
      resetForm();
      if (!again) setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-2 text-sm text-zinc-700 dark:border-white/[.16] dark:text-zinc-200"
      >
        <Plus className="h-4 w-4" /> Novo flashcard
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-black dark:text-zinc-50">Novo flashcard</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                ×
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <label className={labelClassName}>
                Frente
                <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} className={inputClassName} autoFocus />
              </label>
              <label className={labelClassName}>
                Verso
                <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={2} className={inputClassName} />
              </label>
              <label className={labelClassName}>
                Baralho (opcional)
                <select value={deckItemId} onChange={(e) => setDeckItemId(e.target.value)} className={inputClassName}>
                  <option value="">Sem baralho</option>
                  {decks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {deck.title} ({deck.typeLabel})
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={pending || !front.trim() || !back.trim()}
                  className="rounded-full bg-black px-4 py-1.5 text-sm text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-black"
                >
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={pending || !front.trim() || !back.trim()}
                  className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm disabled:opacity-60 dark:border-white/[.16]"
                >
                  Criar e adicionar outro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
