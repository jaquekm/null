"use client";

import { Pause, Play, Square, Timer } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { logStudySession } from "../actions";
import { studySessionKinds } from "../schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

const KIND_LABELS: Record<(typeof studySessionKinds)[number], string> = {
  study: "Estudo",
  review: "Revisão",
  reading: "Leitura",
  practice: "Prática",
  class: "Aula",
};

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const POMODORO_FOCUS_SECONDS = 25 * 60;
const POMODORO_BREAK_SECONDS = 5 * 60;

/** Cronômetro (Pomodoro opcional) + registro manual de `study_sessions` (5.7) — reaproveitável no painel `/estudos` (sem item) ou num item Curso/Livro/Plano. */
export function StudyTimer({ itemId }: { itemId: string | null }) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [pomodoro, setPomodoro] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const startedAtRef = useRef<string | null>(null);
  const lastPhaseRef = useRef<"focus" | "break">("focus");

  const cycleSeconds = POMODORO_FOCUS_SECONDS + POMODORO_BREAK_SECONDS;
  const positionInCycle = seconds % cycleSeconds;
  const phase: "focus" | "break" = positionInCycle < POMODORO_FOCUS_SECONDS ? "focus" : "break";

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!pomodoro || !running) return;
    if (lastPhaseRef.current === phase) return;
    lastPhaseRef.current = phase;
    toast.info(phase === "break" ? "Pomodoro: 25 min completos — hora da pausa (5 min)." : "Pausa terminada — hora de focar (25 min).");
  }, [phase, pomodoro, running]);

  function handleStart() {
    if (!startedAtRef.current) startedAtRef.current = new Date().toISOString();
    setRunning(true);
  }

  function handleStop() {
    setRunning(false);
    const durationMinutes = Math.round(seconds / 60);
    const startedAt = startedAtRef.current;
    startedAtRef.current = null;
    lastPhaseRef.current = "focus";
    setSeconds(0);

    if (!startedAt || durationMinutes < 1) return;
    startTransition(async () => {
      const result = await logStudySession({ itemId, kind: "study", startedAt, endedAt: new Date().toISOString(), durationMinutes });
      if (!result.ok) toast.error(result.error);
      else toast.success(`Sessão de ${durationMinutes} min registrada.`);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-black dark:text-zinc-50">
          <Timer className="h-4 w-4" />
          {formatClock(seconds)}
          {pomodoro && <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">{phase === "focus" ? "foco" : "pausa"}</span>}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <input type="checkbox" checked={pomodoro} onChange={(e) => setPomodoro(e.target.checked)} className="h-3.5 w-3.5" />
          Pomodoro 25/5
        </label>
      </div>

      <div className="flex gap-2">
        {!running ? (
          <button type="button" onClick={handleStart} className="flex items-center gap-1.5 rounded-full bg-black px-4 py-1.5 text-sm text-white dark:bg-zinc-50 dark:text-black">
            <Play className="h-3.5 w-3.5" /> {seconds > 0 ? "Continuar" : "Iniciar"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setRunning(false)}
            className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]"
          >
            <Pause className="h-3.5 w-3.5" /> Pausar
          </button>
        )}
        {seconds > 0 && (
          <button
            type="button"
            onClick={handleStop}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-1.5 text-sm disabled:opacity-60 dark:border-white/[.16]"
          >
            <Square className="h-3.5 w-3.5" /> Parar e registrar
          </button>
        )}
        <button type="button" onClick={() => setManualOpen((v) => !v)} className="ml-auto text-xs text-zinc-500 underline dark:text-zinc-400">
          Registrar manualmente
        </button>
      </div>

      {manualOpen && <ManualSessionForm itemId={itemId} onDone={() => setManualOpen(false)} />}
    </div>
  );
}

function ManualSessionForm({ itemId, onDone }: { itemId: string | null; onDone: () => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [kind, setKind] = useState<(typeof studySessionKinds)[number]>("study");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const startedAt = new Date(`${date}T12:00:00`).toISOString();
      const result = await logStudySession({
        itemId,
        kind,
        startedAt,
        endedAt: new Date(new Date(startedAt).getTime() + durationMinutes * 60_000).toISOString(),
        durationMinutes,
        notes: notes.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Sessão registrada.");
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-black/[.08] pt-3 dark:border-white/[.08]">
      <div className="flex flex-wrap gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClassName} />
        <input
          type="number"
          min={1}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value) || 1)}
          className={`${inputClassName} w-24`}
          placeholder="minutos"
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as (typeof studySessionKinds)[number])} className={inputClassName}>
          {studySessionKinds.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional)" className={inputClassName} />
      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="self-start rounded-full bg-black px-4 py-1.5 text-sm text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-black"
      >
        Salvar sessão
      </button>
    </div>
  );
}
