"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelFasting, endFasting, registerFastingManually, startFasting } from "../actions";
import { elapsedMinutes, formatFastingDuration } from "../lib/fasting";
import type { FastingData } from "../queries";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function ManualFastingForm({ onDone }: { onDone: () => void }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    if (!start || !end) {
      toast.error("Preencha início e fim.");
      return;
    }
    startTransition(async () => {
      const result = await registerFastingManually({ startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString() });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Jejum registrado.");
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-black/[.08] pt-3 dark:border-white/[.08]">
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Início
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputClassName} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Fim
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClassName} />
        </label>
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="self-start rounded-full bg-black px-4 py-1.5 text-sm text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-black"
      >
        Salvar jejum
      </button>
    </div>
  );
}

/** Card "Jejum" do Hoje (10.11): cronômetro (sobrevive a recarregar, diferente do de Foco) + histórico recente. */
export function FastingCard({ active: initialActive, history, averageMinutes }: FastingData) {
  const [active, setActive] = useState(initialActive);
  const [elapsed, setElapsed] = useState(() => (initialActive ? elapsedMinutes(initialActive.startedAt, new Date()) : 0));
  const [manualOpen, setManualOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setElapsed(elapsedMinutes(active.startedAt, new Date())), 30_000);
    return () => clearInterval(interval);
  }, [active]);

  function handleStart() {
    startTransition(async () => {
      const result = await startFasting();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setActive({ id: result.data.id, startedAt: result.data.startedAt });
      setElapsed(0);
      toast.success("Jejum iniciado.");
    });
  }

  function handleEnd() {
    startTransition(async () => {
      const result = await endFasting();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setActive(null);
      toast.success(`Jejum de ${formatFastingDuration(result.data.durationMinutes)} registrado.`);
    });
  }

  function handleCancel() {
    if (!window.confirm("Cancelar este jejum? Ele não entra no histórico.")) return;
    startTransition(async () => {
      const result = await cancelFasting();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setActive(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {active ? (
        <>
          <div>
            <p className="text-lg font-semibold text-black dark:text-zinc-50">Em jejum há {formatFastingDuration(elapsed)}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Começou {formatWhen(active.startedAt)}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleEnd}
              disabled={pending}
              className="rounded-full bg-black px-4 py-1.5 text-sm text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-black"
            >
              Terminar jejum
            </button>
            <button type="button" onClick={handleCancel} disabled={pending} className="text-xs text-zinc-500 hover:underline dark:text-zinc-400">
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          {history[0] ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Último jejum: <strong>{formatFastingDuration(history[0].durationMinutes)}</strong>
              {averageMinutes != null && history.length > 1 && <> · média: {formatFastingDuration(averageMinutes)}</>}
            </p>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum jejum registrado ainda.</p>
          )}
          <button
            type="button"
            onClick={handleStart}
            disabled={pending}
            className="self-start rounded-full bg-black px-4 py-1.5 text-sm text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-black"
          >
            Começar jejum
          </button>
        </>
      )}

      {history.length > 0 && (
        <details className="text-xs text-zinc-500 dark:text-zinc-400">
          <summary className="cursor-pointer select-none">Histórico</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {history.map((entry) => (
              <li key={entry.id} className="flex justify-between gap-2">
                <span>
                  {formatWhen(entry.startedAt)} → {formatWhen(entry.endedAt)}
                </span>
                <span className="font-medium">{formatFastingDuration(entry.durationMinutes)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <button type="button" onClick={() => setManualOpen((v) => !v)} className="self-start text-xs text-zinc-500 underline dark:text-zinc-400">
        Registrar manualmente
      </button>
      {manualOpen && <ManualFastingForm onDone={() => setManualOpen(false)} />}
    </div>
  );
}
