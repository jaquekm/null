"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { renderSimpleMarkdown } from "../lib/simple-markdown";
import { submitReview, suspendCard, updateFlashcardSides } from "../actions";

export interface QueuedCard {
  cardId: string;
  itemId: string;
  title: string;
  front: string;
  back: string;
  deckTitle: string | null;
  previews: { grade: number; label: string; intervalLabel: string }[];
}

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

const GRADE_STYLES: Record<number, string> = {
  1: "border-red-300 text-red-700 dark:border-red-900 dark:text-red-400",
  2: "border-amber-300 text-amber-700 dark:border-amber-900 dark:text-amber-400",
  3: "border-emerald-300 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400",
  4: "border-sky-300 text-sky-700 dark:border-sky-900 dark:text-sky-400",
};

/**
 * Sessão de revisão (5.7): fila já vem pronta do servidor (`/estudos/revisar`,
 * limite diário de novos e prévia de intervalo já aplicados). Cada card é um
 * `ReviewCardPanel` remontado via `key={card.cardId}` — troca de card já
 * nasce com estado limpo (virado/editando/tempo) sem precisar de um efeito
 * "resetar ao mudar de card" (o React já desaconselha isso).
 */
export function ReviewSession({ initialQueue }: { initialQueue: QueuedCard[] }) {
  const [queue] = useState(initialQueue);
  const [index, setIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);

  const current = queue[index];

  function advance() {
    setReviewedCount((n) => n + 1);
    setIndex((i) => i + 1);
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-black/[.08] p-8 text-center dark:border-white/[.08]">
        <p className="text-lg font-medium text-black dark:text-zinc-50">Sessão concluída 🎉</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {reviewedCount > 0 ? `Você revisou ${reviewedCount} card${reviewedCount === 1 ? "" : "s"}.` : "Nada pra revisar agora."}
        </p>
        <Link href="/estudos" className="text-sm text-black underline dark:text-zinc-50">
          Voltar pro painel de estudos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {index + 1} de {queue.length}
      </p>
      <ReviewCardPanel key={current.cardId} card={current} onGraded={advance} onSuspended={advance} />
    </div>
  );
}

function ReviewCardPanel({ card, onGraded, onSuspended }: { card: QueuedCard; onGraded: () => void; onSuspended: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [editFront, setEditFront] = useState(card.front);
  const [editBack, setEditBack] = useState(card.back);
  const [pending, startTransition] = useTransition();
  const cardStartRef = useRef(0);
  useEffect(() => {
    cardStartRef.current = Date.now();
  }, []);

  function handleGrade(grade: number) {
    if (pending || editing) return;
    const durationMs = Date.now() - cardStartRef.current;
    startTransition(async () => {
      const result = await submitReview({ cardId: card.cardId, grade, durationMs });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onGraded();
    });
  }

  function handleSuspend() {
    if (pending) return;
    startTransition(async () => {
      const result = await suspendCard({ cardId: card.cardId, suspended: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Card suspenso.");
      onSuspended();
    });
  }

  function handleSaveEdit() {
    if (pending) return;
    startTransition(async () => {
      const result = await updateFlashcardSides({ itemId: card.itemId, front: editFront, back: editBack });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setFront(editFront);
      setBack(editBack);
      setEditing(false);
      toast.success("Card atualizado.");
    });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (editing || target?.tagName === "TEXTAREA" || target?.tagName === "INPUT") return;

      if (event.code === "Space") {
        event.preventDefault();
        setFlipped((f) => !f);
        return;
      }
      if (flipped && ["Digit1", "Digit2", "Digit3", "Digit4"].includes(event.code)) {
        handleGrade(Number(event.code.slice(-1)));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const frontHtml = useMemo(() => renderSimpleMarkdown(front), [front]);
  const backHtml = useMemo(() => renderSimpleMarkdown(back), [back]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{card.deckTitle ?? "Sem baralho"}</span>
        <button type="button" onClick={handleSuspend} disabled={pending} className="underline disabled:opacity-60">
          Suspender
        </button>
      </div>

      <div className="min-h-[220px] rounded-lg border border-black/[.08] p-6 dark:border-white/[.08]">
        {editing ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Frente
              <textarea value={editFront} onChange={(e) => setEditFront(e.target.value)} rows={3} className={inputClassName} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Verso
              <textarea value={editBack} onChange={(e) => setEditBack(e.target.value)} rows={3} className={inputClassName} />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={pending}
                className="rounded-full bg-black px-4 py-1.5 text-sm text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-black"
              >
                Salvar
              </button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-base text-black dark:text-zinc-50" dangerouslySetInnerHTML={{ __html: frontHtml }} />
            {flipped && (
              <>
                <hr className="border-black/[.08] dark:border-white/[.08]" />
                <div className="text-base text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: backHtml }} />
              </>
            )}
          </div>
        )}
      </div>

      {!editing && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setEditFront(front);
              setEditBack(back);
              setEditing(true);
            }}
            className="text-xs text-zinc-500 underline dark:text-zinc-400"
          >
            Editar
          </button>

          {!flipped ? (
            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="ml-auto rounded-full bg-black px-6 py-2 text-sm text-white dark:bg-zinc-50 dark:text-black"
            >
              Mostrar resposta <span className="opacity-60">(espaço)</span>
            </button>
          ) : (
            <div className="ml-auto grid grid-cols-2 gap-2 sm:grid-cols-4">
              {card.previews.map((preview) => (
                <button
                  key={preview.grade}
                  type="button"
                  disabled={pending}
                  onClick={() => handleGrade(preview.grade)}
                  className={`flex flex-col items-center rounded-lg border px-3 py-1.5 text-sm disabled:opacity-60 ${GRADE_STYLES[preview.grade] ?? ""}`}
                >
                  <span>
                    {preview.label} <span className="opacity-60">({preview.grade})</span>
                  </span>
                  <span className="text-xs opacity-70">{preview.intervalLabel}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
