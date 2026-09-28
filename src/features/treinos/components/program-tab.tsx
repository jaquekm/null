"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { activateWorkoutProgram, deleteWorkoutProgram, previewProgramImport, saveWorkoutProgram } from "../actions";
import { exerciseIdFromName, type Prescription, type ProgramDefinition, type ProgramExercise } from "../lib/program";
import type { WorkoutProgram } from "../queries";
import { Field, cardClassName, inputClassName } from "./ui";

const smallInput = `${inputClassName} w-14 px-1.5 text-center`;
const LETTERS = "ABCDEFG".split("");

function blankExercise(existingIds: Set<string>, name = "Novo exercício"): ProgramExercise {
  let id = exerciseIdFromName(name);
  for (let n = 2; existingIds.has(id); n++) id = `${exerciseIdFromName(name)}_${n}`;
  return {
    id,
    name,
    early: { sets: 2, min: 12, max: 12, rir: "3–4" },
    later: { sets: 3, min: 10, max: 12, rir: "2" },
    unit: "reps",
    load: true,
    sensitive: false,
    increment: "+1 placa, 2,5–5 kg",
  };
}

function PrescriptionInputs({ label, value, onChange }: { label: string; value: Prescription; onChange: (p: Prescription) => void }) {
  const num = (v: string) => Math.max(1, Math.min(600, Number(v.replace(/\D/g, "")) || 1));
  return (
    <div className="flex flex-wrap items-end gap-1.5">
      <span className="w-full text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <input aria-label={`${label}: séries`} className={smallInput} value={value.sets} onChange={(e) => onChange({ ...value, sets: Math.min(10, num(e.target.value)) })} />
      <span className="pb-1.5 text-xs">×</span>
      <input aria-label={`${label}: mínimo`} className={smallInput} value={value.min} onChange={(e) => onChange({ ...value, min: num(e.target.value) })} />
      <span className="pb-1.5 text-xs">a</span>
      <input aria-label={`${label}: máximo`} className={smallInput} value={value.max} onChange={(e) => onChange({ ...value, max: num(e.target.value) })} />
      <span className="pb-1.5 text-xs">RIR</span>
      <input aria-label={`${label}: RIR`} className={`${inputClassName} w-16 px-1.5`} value={value.rir} maxLength={10} onChange={(e) => onChange({ ...value, rir: e.target.value })} />
    </div>
  );
}

/** Editor do programa: treinos (A, B, C…) e, em cada um, exercícios com a prescrição das semanas 1–2 e 3+. */
function ProgramEditor({
  initialName,
  initialDefinition,
  programId,
  onDone,
  onCancel,
}: {
  initialName: string;
  initialDefinition: ProgramDefinition;
  programId?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [definition, setDefinition] = useState<ProgramDefinition>(initialDefinition);
  const [pending, startTransition] = useTransition();

  const allIds = new Set(definition.workouts.flatMap((w) => w.exercises.map((e) => e.id)));

  // Um exercício pode estar em mais de um treino (mesmo id): editar muda em todos.
  const updateExercise = (id: string, patch: Partial<ProgramExercise>) =>
    setDefinition((d) => ({
      workouts: d.workouts.map((w) => ({ ...w, exercises: w.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
    }));

  const updateWorkout = (workoutId: string, patch: { name?: string; exercises?: ProgramExercise[] }) =>
    setDefinition((d) => ({ workouts: d.workouts.map((w) => (w.id === workoutId ? { ...w, ...patch } : w)) }));

  function addWorkout() {
    const letter = LETTERS.find((l) => !definition.workouts.some((w) => w.id === l));
    if (!letter) return;
    setDefinition((d) => ({ workouts: [...d.workouts, { id: letter, name: `Treino ${letter}`, exercises: [blankExercise(allIds)] }] }));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveWorkoutProgram({ id: programId, name, definition, activate: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Programa salvo e em uso.");
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Nome do programa">
        <input className={inputClassName} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </Field>

      {definition.workouts.map((workout) => (
        <section key={workout.id} className={cardClassName}>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black text-sm font-bold text-white dark:bg-white dark:text-black">
              {workout.id}
            </span>
            <input
              aria-label={`Nome do treino ${workout.id}`}
              className={`${inputClassName} min-w-0 flex-1 font-semibold`}
              value={workout.name}
              maxLength={120}
              onChange={(e) => updateWorkout(workout.id, { name: e.target.value })}
            />
            {definition.workouts.length > 1 && (
              <button
                type="button"
                aria-label={`Remover treino ${workout.id}`}
                onClick={() => {
                  if (window.confirm(`Remover o treino ${workout.id}?`)) setDefinition((d) => ({ workouts: d.workouts.filter((w) => w.id !== workout.id) }));
                }}
                className="text-zinc-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {workout.exercises.map((ex, index) => (
            <div key={`${ex.id}-${index}`} className="flex flex-col gap-2 border-t border-black/[.06] pt-3 dark:border-white/[.06]">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">
                  {workout.id}
                  {index + 1}
                </span>
                <input
                  aria-label="Nome do exercício"
                  className={`${inputClassName} min-w-0 flex-1`}
                  value={ex.name}
                  maxLength={120}
                  onChange={(e) => updateExercise(ex.id, { name: e.target.value })}
                />
                <button
                  type="button"
                  aria-label={`Remover ${ex.name} do treino ${workout.id}`}
                  onClick={() => updateWorkout(workout.id, { exercises: workout.exercises.filter((_, i) => i !== index) })}
                  className="text-zinc-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-4">
                <PrescriptionInputs label="Semanas 1–2" value={ex.early} onChange={(early) => updateExercise(ex.id, { early })} />
                <PrescriptionInputs label="Semana 3+" value={ex.later} onChange={(later) => updateExercise(ex.id, { later })} />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={ex.load} onChange={(e) => updateExercise(ex.id, { load: e.target.checked })} />
                  Usa carga (kg)
                </label>
                <label className="flex items-center gap-1.5" title="Só sugere subir carga com dor ≤2 durante e na manhã seguinte">
                  <input type="checkbox" checked={ex.sensitive} onChange={(e) => updateExercise(ex.id, { sensitive: e.target.checked })} />
                  Joelho/lombar sensível
                </label>
                <label className="flex items-center gap-1.5">
                  Unidade
                  <select className={`${inputClassName} py-1`} value={ex.unit} onChange={(e) => updateExercise(ex.id, { unit: e.target.value })}>
                    {["reps", "reps/lado", "s", "s/lado"].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-0 flex-1 items-center gap-1.5">
                  Como progredir
                  <input className={`${inputClassName} min-w-0 flex-1 py-1`} value={ex.increment} maxLength={60} onChange={(e) => updateExercise(ex.id, { increment: e.target.value })} />
                </label>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => updateWorkout(workout.id, { exercises: [...workout.exercises, blankExercise(allIds)] })}
            className="flex items-center gap-1 self-start text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            <Plus className="h-4 w-4" /> Adicionar exercício
          </button>
        </section>
      ))}

      {definition.workouts.length < LETTERS.length && (
        <button type="button" onClick={addWorkout} className="flex items-center gap-1 self-start text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          <Plus className="h-4 w-4" /> Adicionar treino
        </button>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={handleSave}
          className="flex-1 rounded-xl bg-black py-3 font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {pending ? "Salvando…" : "Salvar e usar este programa"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-xl border border-black/[.12] px-4 text-sm dark:border-white/[.16]">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

type Mode = { kind: "view" } | { kind: "edit"; program: WorkoutProgram } | { kind: "new"; name: string; definition: ProgramDefinition; warnings: string[] };

export function ProgramTab({ programs, onChanged }: { programs: WorkoutProgram[]; onChanged: () => void }) {
  const active = programs.find((p) => p.active) ?? null;
  const [mode, setMode] = useState<Mode>({ kind: "view" });
  const [pending, startTransition] = useTransition();

  function handleImport(file: File | null) {
    if (!file) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await previewProgramImport(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setMode({ kind: "new", name: result.data.name, definition: result.data.definition, warnings: result.data.warnings });
    });
  }

  function startBlank() {
    setMode({ kind: "new", name: "Meu programa", definition: { workouts: [{ id: "A", name: "Treino A", exercises: [blankExercise(new Set())] }] }, warnings: [] });
  }

  const done = () => {
    setMode({ kind: "view" });
    onChanged();
  };

  if (mode.kind === "new") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Confira os treinos e as séries. Corrija o que precisar antes de salvar — dá para editar depois também.
        </p>
        {mode.warnings.map((w) => (
          <p key={w} className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {w}
          </p>
        ))}
        <ProgramEditor initialName={mode.name} initialDefinition={mode.definition} onDone={done} onCancel={() => setMode({ kind: "view" })} />
      </div>
    );
  }

  if (mode.kind === "edit") {
    return (
      <ProgramEditor
        key={mode.program.id}
        programId={mode.program.id}
        initialName={mode.program.name}
        initialDefinition={mode.program.definition}
        onDone={done}
        onCancel={() => setMode({ kind: "view" })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <section className={cardClassName}>
        <h2 className="font-semibold">Montar um programa</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Importe o Word do seu programa: cada <strong>Treino A, B, C…</strong> vira um treino, e cada exercício (A1, A2…) vem com as séries, repetições e RIR
          das semanas 1–2 e 3+. Ou monte do zero.
        </p>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">
            {pending ? "Lendo…" : "Importar Word (.docx)"}
            <input type="file" accept=".docx,.txt,.md" className="sr-only" disabled={pending} onChange={(e) => handleImport(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" onClick={startBlank} className="rounded-lg border border-black/[.12] px-4 py-2 text-sm dark:border-white/[.16]">
            Montar do zero
          </button>
        </div>
      </section>

      {programs.map((program) => (
        <section key={program.id} className={cardClassName}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">
              {program.name}
              {program.active && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-normal text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Em uso</span>}
            </h3>
            <div className="flex gap-3 text-xs">
              <button type="button" onClick={() => setMode({ kind: "edit", program })} className="hover:underline">
                Editar
              </button>
              {!program.active && (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await activateWorkoutProgram(program.id);
                      if (!result.ok) toast.error(result.error);
                      else onChanged();
                    })
                  }
                  className="hover:underline"
                >
                  Usar este
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(`Excluir o programa "${program.name}"? Os treinos já registrados continuam no histórico.`)) return;
                  startTransition(async () => {
                    const result = await deleteWorkoutProgram(program.id);
                    if (!result.ok) toast.error(result.error);
                    else onChanged();
                  });
                }}
                className="text-red-600 hover:underline dark:text-red-400"
              >
                Excluir
              </button>
            </div>
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {program.definition.workouts.map((w) => (
              <li key={w.id}>
                <strong>{w.id}</strong> — {w.name}: <span className="text-zinc-500 dark:text-zinc-400">{w.exercises.map((e) => e.name).join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {!active && programs.length > 0 && <p className="text-sm text-amber-700 dark:text-amber-300">Nenhum programa em uso: escolha um com “Usar este”.</p>}
    </div>
  );
}
