"use client";

import type { Editor } from "@tiptap/core";
import { diffWords } from "diff";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { improveSelectedText, saveVersionBeforeAiEdit } from "@/features/ai/actions";
import { IMPROVE_TEXT_ACTIONS, type ImproveTextAction, type TranslateLanguage } from "@/features/ai/prompts/improve-text";

const ACTION_LABELS: Record<ImproveTextAction, string> = {
  revisar: "Revisar",
  encurtar: "Encurtar",
  formal: "Deixar formal",
  traduzir: "Traduzir",
};

interface PendingDiff {
  from: number;
  to: number;
  before: string;
  after: string;
}

/**
 * "Melhorar texto" (6.8) — botão "IA" na bubble menu (seleção do editor):
 * escolhe a ação, mostra o diff (`diffWords`, mesma lib/estilo de
 * `version-detail-dialog.tsx`, "Comparar" de versões) antes de aplicar.
 * `from`/`to` são capturados no clique (não recalculados depois) — a
 * seleção pode não existir mais quando a resposta chegar.
 */
export function ImproveTextMenu({ editor, itemId }: { editor: Editor; itemId: string }) {
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<ImproveTextAction | null>(null);
  const [diff, setDiff] = useState<PendingDiff | null>(null);
  const [applying, setApplying] = useState(false);

  function handleChoose(action: ImproveTextAction) {
    setOpen(false);

    let targetLanguage: TranslateLanguage | undefined;
    if (action === "traduzir") {
      const choice = window.prompt('Traduzir para: digite "en" (inglês) ou "es" (espanhol)', "en");
      if (choice !== "en" && choice !== "es") return;
      targetLanguage = choice;
    }

    const { from, to } = editor.state.selection;
    const before = editor.state.doc.textBetween(from, to, "\n");
    if (!before.trim()) return;

    setPendingAction(action);
    void improveSelectedText({ itemId, text: before, action, targetLanguage }).then((result) => {
      setPendingAction(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDiff({ from, to, before, after: result.data });
    });
  }

  function handleApply() {
    if (!diff) return;
    setApplying(true);
    void saveVersionBeforeAiEdit(itemId).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        setApplying(false);
        return;
      }
      editor.chain().focus().insertContentAt({ from: diff.from, to: diff.to }, diff.after).run();
      setDiff(null);
      setApplying(false);
    });
  }

  if (diff) {
    return (
      <div className="absolute top-full left-0 z-10 mt-1 flex w-80 flex-col gap-2 rounded-lg border border-black/[.08] bg-white p-3 text-sm shadow-lg dark:border-white/[.08] dark:bg-zinc-900">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Prévia</p>
        <p className="leading-relaxed whitespace-pre-wrap">
          {diffWords(diff.before, diff.after).map((part, index) => (
            <span
              key={index}
              className={
                part.added
                  ? "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200"
                  : part.removed
                    ? "bg-red-100 text-red-900 line-through dark:bg-red-900/40 dark:text-red-200"
                    : undefined
              }
            >
              {part.value}
            </span>
          ))}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={handleApply} disabled={applying} className="rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]">
            {applying ? "Aplicando…" : "Aplicar"}
          </button>
          <button type="button" onClick={() => setDiff(null)} disabled={applying} className="rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={pendingAction !== null}
        aria-label="Melhorar com IA"
        className="flex h-7 items-center gap-1 rounded px-1.5 text-xs hover:bg-black/[.06] dark:hover:bg-white/[.08]"
      >
        <Sparkles className="h-4 w-4" />
        {pendingAction && "…"}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-10 mt-1 flex w-40 flex-col rounded-lg border border-black/[.08] bg-white p-1 text-sm shadow-lg dark:border-white/[.08] dark:bg-zinc-900">
          {IMPROVE_TEXT_ACTIONS.map((action) => (
            <button key={action} type="button" onClick={() => handleChoose(action)} className="rounded px-2 py-1 text-left hover:bg-black/[.06] dark:hover:bg-white/[.08]">
              {ACTION_LABELS[action]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
