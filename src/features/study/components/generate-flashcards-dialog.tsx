"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { approveGeneratedFlashcards, generateFlashcardsFromItem, searchDeckCandidates, searchSourceItems } from "../actions";
import type { DeckCandidate } from "../queries";
import type { GeneratedFlashcard } from "../schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

interface DraftCard extends GeneratedFlashcard {
  included: boolean;
}

/** "Gerar flashcards com IA" (5.7): gera a partir de um item de origem, revisa/edita/descarta antes de criar de verdade. */
export function GenerateFlashcardsDialog({ spaceId }: { spaceId: string | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; title: string }[]>([]);
  const [source, setSource] = useState<{ id: string; title: string } | null>(null);
  const [maxCards, setMaxCards] = useState(15);
  const [drafts, setDrafts] = useState<DraftCard[] | null>(null);
  const [decks, setDecks] = useState<DeckCandidate[]>([]);
  const [deckItemId, setDeckItemId] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => setDecks(await searchDeckCandidates()));
  }, [open]);

  useEffect(() => {
    if (!open || source) return;
    const timeout = setTimeout(() => {
      startTransition(async () => setResults(await searchSourceItems(query)));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, open, source]);

  function resetAll() {
    setQuery("");
    setResults([]);
    setSource(null);
    setMaxCards(15);
    setDrafts(null);
    setDeckItemId("");
  }

  function handleGenerate() {
    if (!source) return;
    startTransition(async () => {
      const result = await generateFlashcardsFromItem({ sourceItemId: source.id, maxCards });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDrafts(result.data.map((card) => ({ ...card, included: true })));
    });
  }

  function updateDraft(index: number, patch: Partial<DraftCard>) {
    setDrafts((current) => current?.map((card, i) => (i === index ? { ...card, ...patch } : card)) ?? null);
  }

  function handleApprove() {
    if (!drafts) return;
    const cards = drafts.filter((card) => card.included).map(({ front, back }) => ({ front, back }));
    if (cards.length === 0) {
      toast.error("Marque ao menos um card pra criar.");
      return;
    }
    startTransition(async () => {
      const result = await approveGeneratedFlashcards({ spaceId, deckItemId: deckItemId || null, cards });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.created} flashcard${result.data.created === 1 ? "" : "s"} criado${result.data.created === 1 ? "" : "s"}.`);
      resetAll();
      setOpen(false);
    });
  }

  const includedCount = drafts?.filter((card) => card.included).length ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-2 text-sm text-zinc-700 dark:border-white/[.16] dark:text-zinc-200"
      >
        <Sparkles className="h-4 w-4" /> Gerar com IA
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setOpen(false);
            resetAll();
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-black dark:text-zinc-50">Gerar flashcards com IA</h2>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetAll();
                }}
                aria-label="Fechar"
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                ×
              </button>
            </div>

            {!drafts ? (
              <div className="flex flex-col gap-3">
                <label className={labelClassName}>
                  Item de origem (nota, transcrição, documento…)
                  {source ? (
                    <div className="flex items-center justify-between rounded-lg border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
                      <span className="truncate">{source.title}</span>
                      <button type="button" onClick={() => setSource(null)} className="text-xs text-zinc-400 underline">
                        Trocar
                      </button>
                    </div>
                  ) : (
                    <>
                      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar item…" className={inputClassName} autoFocus />
                      {results.length > 0 && (
                        <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                          {results.map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => setSource(item)}
                                className="w-full truncate rounded-lg border border-black/[.08] px-2.5 py-1.5 text-left text-sm hover:bg-black/[.02] dark:border-white/[.08] dark:hover:bg-white/[.04]"
                              >
                                {item.title || "Sem título"}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </label>

                <label className={labelClassName}>
                  Máximo de cards
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={maxCards}
                    onChange={(e) => setMaxCards(Number(e.target.value) || 1)}
                    className={`${inputClassName} w-24`}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={pending || !source}
                  className="self-start rounded-full bg-black px-4 py-1.5 text-sm text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-black"
                >
                  {pending ? "Gerando..." : "Gerar"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {drafts.length} card{drafts.length === 1 ? "" : "s"} gerado{drafts.length === 1 ? "" : "s"} — revise, edite ou desmarque antes de criar.
                </p>

                <ul className="flex flex-col gap-2">
                  {drafts.map((card, index) => (
                    <li key={index} className="flex gap-2 rounded-lg border border-black/[.08] p-2 dark:border-white/[.08]">
                      <input
                        type="checkbox"
                        checked={card.included}
                        onChange={(e) => updateDraft(index, { included: e.target.checked })}
                        className="mt-1.5 h-4 w-4 shrink-0"
                      />
                      <div className="flex flex-1 flex-col gap-1">
                        <textarea value={card.front} onChange={(e) => updateDraft(index, { front: e.target.value })} rows={1} className={inputClassName} />
                        <textarea value={card.back} onChange={(e) => updateDraft(index, { back: e.target.value })} rows={1} className={inputClassName} />
                      </div>
                    </li>
                  ))}
                </ul>

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

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={pending || includedCount === 0}
                    className="rounded-full bg-black px-4 py-1.5 text-sm text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-black"
                  >
                    Criar {includedCount} flashcard{includedCount === 1 ? "" : "s"}
                  </button>
                  <button type="button" onClick={() => setDrafts(null)} className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]">
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
