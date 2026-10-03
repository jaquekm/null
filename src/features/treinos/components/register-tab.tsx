"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { todayInTimezone } from "@/lib/dates";
import { saveWorkoutSession } from "../actions";
import { findWorkout, prescriptionFor } from "../lib/program";
import {
  TRAFFIC_LIGHT_TEXT,
  emptyEntries,
  exerciseHistory,
  nextWorkout,
  parseDecimal,
  programWeek,
  suggestion,
  trafficLight,
  validReps,
  type ExerciseEntry,
  type SuggestionTone,
  type TrafficLight,
} from "../lib/rules";
import type { WorkoutProgram, WorkoutSession } from "../queries";
import { ChoiceButtons, Field, PainSelect, cardClassName, formatShortDate, inputClassName } from "./ui";

const DRAFT_KEY = "treinos:rascunho";

interface Draft {
  programId: string;
  date: string;
  week: number;
  workout: string;
  sleep: string;
  energy: number;
  kneePainBefore: number;
  backPainBefore: number;
  swelling: boolean;
  sick: boolean;
  exercises: Record<string, ExerciseEntry>;
  duration: string;
  kneePainAfter: number;
  backPainAfter: number;
  notes: string;
}

function newDraft(program: WorkoutProgram, sessions: WorkoutSession[]): Draft {
  const date = todayInTimezone();
  const workout = nextWorkout(program.definition, sessions);
  return {
    programId: program.id,
    date,
    week: programWeek(sessions, date),
    workout,
    sleep: "7",
    energy: 3,
    kneePainBefore: 0,
    backPainBefore: 0,
    swelling: false,
    sick: false,
    exercises: emptyEntries(findWorkout(program.definition, workout)!, sessions),
    duration: "",
    kneePainAfter: 0,
    backPainAfter: 0,
    notes: "",
  };
}

/** Formulário preenchido com um treino já salvo, pra corrigir (data errada, série digitada errado…) sem excluir e lançar de novo. */
export function draftFromSession(program: WorkoutProgram, session: WorkoutSession): Draft {
  const workout = findWorkout(program.definition, session.workout) ?? program.definition.workouts[0]!;
  const blank = emptyEntries(workout, []);
  return {
    programId: program.id,
    date: session.date,
    week: session.week,
    workout: workout.id,
    sleep: session.sleepHours === null ? "" : String(session.sleepHours),
    energy: session.energy,
    kneePainBefore: session.kneePainBefore,
    backPainBefore: session.backPainBefore,
    swelling: session.swelling,
    sick: session.sick,
    exercises: Object.fromEntries(Object.entries(blank).map(([id, entry]) => [id, { ...entry, ...(session.exercises[id] ?? {}) }])),
    duration: session.durationMin === null ? "" : String(session.durationMin),
    kneePainAfter: session.kneePainAfter ?? 0,
    backPainAfter: session.backPainAfter ?? 0,
    notes: session.notes,
  };
}

// Rascunho só neste navegador (conveniência): some ao salvar o treino.
// Rascunho de outro programa (trocou o ativo) é descartado.
function readDraft(program: WorkoutProgram): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    const parsed = raw ? (JSON.parse(raw) as Draft) : null;
    return parsed && parsed.exercises && parsed.programId === program.id && findWorkout(program.definition, parsed.workout) ? parsed : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // navegador sem storage: o rascunho só não sobrevive a recarregar
  }
}

const TONE_CLASS: Record<SuggestionTone, string> = {
  green: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  red: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  blue: "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  gray: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export const LIGHT_CLASS: Record<TrafficLight, string> = {
  green: "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  yellow: "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  red: "border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
};

export function RegisterTab({
  program,
  sessions: allSessions,
  onSaved,
  editing = null,
  onCancelEdit,
}: {
  program: WorkoutProgram;
  sessions: WorkoutSession[];
  onSaved: () => void;
  /** Treino já salvo sendo corrigido — sem rascunho no navegador, "Salvar" atualiza em vez de criar. */
  editing?: WorkoutSession | null;
  onCancelEdit?: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(() => (editing ? draftFromSession(program, editing) : null));
  const [pending, startTransition] = useTransition();
  // Dicas ("última vez", sugestão de carga) não contam o próprio treino que está sendo corrigido.
  const sessions = editing ? allSessions.filter((s) => s.id !== editing.id) : allSessions;

  // Rascunho vem do navegador só depois de montar (no servidor não existe localStorage).
  useEffect(() => {
    if (editing) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do rascunho salvo no navegador
    setDraft(readDraft(program) ?? newDraft(program, sessions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draft || editing) return;
    const timer = setTimeout(() => writeDraft(draft), 800);
    return () => clearTimeout(timer);
  }, [draft, editing]);

  if (!draft) return <p className="text-sm text-zinc-500">Carregando…</p>;
  const workout = findWorkout(program.definition, draft.workout) ?? program.definition.workouts[0]!;

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const updateExercise = (id: string, patch: Partial<ExerciseEntry>) =>
    setDraft((d) => (d ? { ...d, exercises: { ...d.exercises, [id]: { ...d.exercises[id]!, ...patch } } } : d));
  const setRep = (id: string, index: number, value: string) =>
    setDraft((d) => {
      if (!d) return d;
      const reps = [...(d.exercises[id]?.reps ?? [])];
      reps[index] = value.replace(/\D/g, "").slice(0, 3);
      return { ...d, exercises: { ...d.exercises, [id]: { ...d.exercises[id]!, reps } } };
    });

  const light = trafficLight({
    sleepHours: parseDecimal(draft.sleep),
    energy: draft.energy,
    kneePainBefore: draft.kneePainBefore,
    backPainBefore: draft.backPainBefore,
    swelling: draft.swelling,
    sick: draft.sick,
  });

  function handleSave() {
    if (!draft) return;
    startTransition(async () => {
      const result = await saveWorkoutSession({
        sessionId: editing?.id,
        programId: draft.programId,
        date: draft.date,
        week: Math.max(1, Number(draft.week) || 1),
        workout: draft.workout,
        sleepHours: parseDecimal(draft.sleep),
        energy: draft.energy,
        kneePainBefore: draft.kneePainBefore,
        backPainBefore: draft.backPainBefore,
        swelling: draft.swelling,
        sick: draft.sick,
        exercises: draft.exercises,
        durationMin: draft.duration === "" ? null : Number(draft.duration),
        kneePainAfter: draft.kneePainAfter,
        backPainAfter: draft.backPainAfter,
        notes: draft.notes,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "Treino corrigido!" : "Treino salvo!");
      if (!editing) writeDraft(null);
      onSaved();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {editing && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/40 bg-brand-soft px-4 py-3 text-sm text-brand-text">
          <span>
            <strong>Corrigindo o treino de {formatShortDate(editing.date)}.</strong> Mude o que precisar (data, séries, cargas…) e toque em “Salvar correção”.
          </span>
          <button type="button" onClick={onCancelEdit} className="font-medium underline">
            Cancelar
          </button>
        </div>
      )}
      <section className={cardClassName}>
        <h2 className="font-semibold">Check-in</h2>
        <div className="flex flex-wrap gap-3">
          <Field label="Data">
            <input type="date" className={inputClassName} value={draft.date} onChange={(e) => update({ date: e.target.value })} />
          </Field>
          <Field label="Semana do programa">
            <input
              inputMode="numeric"
              className={`${inputClassName} w-24`}
              value={draft.week}
              onChange={(e) => update({ week: Number(e.target.value.replace(/\D/g, "")) || 1 })}
            />
          </Field>
          <Field label="Sono (h)">
            <input inputMode="decimal" className={`${inputClassName} w-24`} value={draft.sleep} onChange={(e) => update({ sleep: e.target.value })} />
          </Field>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Treino</span>
          <ChoiceButtons
            label="Treino"
            options={program.definition.workouts.map((w) => w.id)}
            value={workout.id}
            onChange={(id) => update({ workout: id, exercises: emptyEntries(findWorkout(program.definition, id)!, sessions) })}
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{workout.name}</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Energia (1 = esgotada, 5 = ótima)</span>
          <ChoiceButtons label="Energia" options={[1, 2, 3, 4, 5]} value={draft.energy} onChange={(energy) => update({ energy })} />
        </div>

        <div className="flex flex-wrap gap-3">
          <Field label="Dor joelho em repouso">
            <PainSelect label="Dor joelho em repouso" value={draft.kneePainBefore} onChange={(v) => update({ kneePainBefore: v ?? 0 })} />
          </Field>
          <Field label="Dor lombar em repouso">
            <PainSelect label="Dor lombar em repouso" value={draft.backPainBefore} onChange={(v) => update({ backPainBefore: v ?? 0 })} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.swelling} onChange={(e) => update({ swelling: e.target.checked })} />
            Joelho inchado/falseando
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.sick} onChange={(e) => update({ sick: e.target.checked })} />
            Doente
          </label>
        </div>

        <div role="status" className={`rounded-lg border-l-4 p-3 ${LIGHT_CLASS[light]}`}>
          <p className="font-semibold">{TRAFFIC_LIGHT_TEXT[light].title}</p>
          <p className="text-sm">{TRAFFIC_LIGHT_TEXT[light].text}</p>
        </div>
      </section>

      {workout.exercises.map((def) => {
        const id = def.id;
        const { sets, min, max, rir: rirTarget } = prescriptionFor(def, draft.week);
        const entry = draft.exercises[id] ?? { name: def.name, load: "", reps: [], rir: null, pain: 0, note: "", skipped: false };
        const last = exerciseHistory(id, sessions).at(-1);
        const tip = suggestion(def, sessions);
        return (
          <section key={id} className={`${cardClassName} ${entry.skipped ? "opacity-50" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{def.name}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {sets} × {min === max ? min : `${min}–${max}`} {def.unit}
                  {rirTarget !== "—" ? ` · RIR ${rirTarget}` : ""}
                </p>
              </div>
              <label className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <input type="checkbox" checked={entry.skipped} onChange={(e) => updateExercise(id, { skipped: e.target.checked })} />
                Pulei
              </label>
            </div>
            {last && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Última ({formatShortDate(last.date)}): {def.load && last.load ? `${last.load} kg · ` : ""}
                {validReps(last.reps).join("/")}
                {last.rir !== null ? ` · RIR ${last.rir}` : ""}
                {last.pain > 0 ? ` · dor ${last.pain}` : ""}
              </p>
            )}
            <p className={`rounded-md px-2 py-1 text-xs ${TONE_CLASS[tip.tone]}`}>{tip.text}</p>
            <div className="flex flex-wrap items-end gap-2">
              {def.load && (
                <Field label="Carga (kg)">
                  <input
                    inputMode="decimal"
                    className={`${inputClassName} w-20`}
                    value={entry.load}
                    onChange={(e) => updateExercise(id, { load: e.target.value.replace(/[^\d.,]/g, "").slice(0, 7) })}
                  />
                </Field>
              )}
              {Array.from({ length: sets }, (_, i) => (
                <Field key={i} label={`Série ${i + 1}`}>
                  <input inputMode="numeric" className={`${inputClassName} w-16`} value={entry.reps[i] ?? ""} onChange={(e) => setRep(id, i, e.target.value)} />
                </Field>
              ))}
              {rirTarget !== "—" && (
                <Field label="RIR última">
                  <select
                    className={inputClassName}
                    value={entry.rir ?? ""}
                    onChange={(e) => updateExercise(id, { rir: e.target.value === "" ? null : Number(e.target.value) })}
                  >
                    <option value="">—</option>
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n === 5 ? "5+" : n}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Dor 0–10">
                <PainSelect label={`Dor em ${def.name}`} value={entry.pain} onChange={(v) => updateExercise(id, { pain: v ?? 0 })} />
              </Field>
            </div>
            <input
              placeholder="Observação (ex.: joelho entrou na última rep)"
              className={`${inputClassName} w-full`}
              maxLength={300}
              value={entry.note}
              onChange={(e) => updateExercise(id, { note: e.target.value })}
            />
          </section>
        );
      })}

      <section className={cardClassName}>
        <h2 className="font-semibold">Fim do treino</h2>
        <div className="flex flex-wrap gap-3">
          <Field label="Duração (min)">
            <input
              inputMode="numeric"
              className={`${inputClassName} w-24`}
              value={draft.duration}
              onChange={(e) => update({ duration: e.target.value.replace(/\D/g, "").slice(0, 3) })}
            />
          </Field>
          <Field label="Dor joelho depois">
            <PainSelect label="Dor joelho depois" value={draft.kneePainAfter} onChange={(v) => update({ kneePainAfter: v ?? 0 })} />
          </Field>
          <Field label="Dor lombar depois">
            <PainSelect label="Dor lombar depois" value={draft.backPainAfter} onChange={(v) => update({ backPainAfter: v ?? 0 })} />
          </Field>
        </div>
        {Number(draft.duration) > 65 && (
          <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Passou de 65 min: corte intervalos ou 1 série no próximo.
          </p>
        )}
        <textarea
          placeholder="Observações gerais"
          rows={2}
          maxLength={2000}
          className={`${inputClassName} w-full`}
          value={draft.notes}
          onChange={(e) => update({ notes: e.target.value })}
        />
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="rounded-xl bg-brand py-3 font-semibold text-brand-fg disabled:opacity-60"
        >
          {pending ? "Salvando…" : editing ? "Salvar correção" : "Salvar treino"}
        </button>
        {editing ? (
          <button type="button" onClick={onCancelEdit} className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
            Cancelar e voltar ao histórico
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              writeDraft(null);
              setDraft(newDraft(program, sessions));
            }}
            className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            Descartar rascunho e recomeçar
          </button>
        )}
      </section>
    </div>
  );
}
