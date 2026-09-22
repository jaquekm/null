"use client";

import { Upload } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { importAnkiCards, searchDeckCandidates } from "../actions";
import { parseAnkiExport } from "../lib/anki-import";
import type { DeckCandidate } from "../queries";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

/** "Importar do Anki" (5.7): cola/carrega o TXT/CSV exportado (frente;verso ou tab) e escolhe o baralho. */
export function ImportAnkiDialog({ spaceId }: { spaceId: string | null }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [deckItemId, setDeckItemId] = useState("");
  const [decks, setDecks] = useState<DeckCandidate[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => setDecks(await searchDeckCandidates()));
  }, [open]);

  const preview = useMemo(() => parseAnkiExport(text), [text]);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setText(typeof reader.result === "string" ? reader.result : "");
    reader.readAsText(file);
  }

  function resetForm() {
    setText("");
    setDeckItemId("");
  }

  function handleImport() {
    startTransition(async () => {
      const result = await importAnkiCards({ spaceId, deckItemId: deckItemId || null, text });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.created} flashcard${result.data.created === 1 ? "" : "s"} importado${result.data.created === 1 ? "" : "s"}.`);
      resetForm();
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-2 text-sm text-zinc-700 dark:border-white/[.16] dark:text-zinc-200"
      >
        <Upload className="h-4 w-4" /> Importar do Anki
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setOpen(false);
            resetForm();
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-black dark:text-zinc-50">Importar do Anki</h2>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                aria-label="Fechar"
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Exporte do Anki como texto plano (frente;verso ou com tab, um card por linha) e cole abaixo, ou carregue o arquivo.
              </p>
              <input
                type="file"
                accept=".txt,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                className="text-sm"
              />
              <label className={labelClassName}>
                Conteúdo
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className={`${inputClassName} font-mono text-xs`} />
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {preview.length} card{preview.length === 1 ? "" : "s"} reconhecido{preview.length === 1 ? "" : "s"}.
              </p>

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

              <button
                type="button"
                onClick={handleImport}
                disabled={pending || preview.length === 0}
                className="self-start rounded-full bg-black px-4 py-1.5 text-sm text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-black"
              >
                Importar {preview.length} card{preview.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
