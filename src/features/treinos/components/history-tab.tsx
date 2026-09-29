"use client";

import { ChevronDown } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { deleteWorkoutSession, updateMorningPain } from "../actions";
import { TRAFFIC_LIGHT_TEXT, sessionHasExercises, validReps } from "../lib/rules";
import type { WeeklyMeasure, WorkoutProgram, WorkoutSession } from "../queries";
import { formatSessionDay, groupByWeek, summarizeSession, weekLabel } from "../lib/history";
import { todayInTimezone } from "@/lib/dates";
import { buildSessionsCsv, buildWeeklyCsv, downloadCsv } from "../lib/csv-export";
import { Field, PainSelect, cardClassName } from "./ui";

const LIGHT_BADGE: Record<WorkoutSession["trafficLight"], string> = {
  green: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100",
  yellow: "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100",
  red: "bg-red-100 text-red-900 dark:bg-red-900/60 dark:text-red-100",
};
const LIGHT_DOT: Record<WorkoutSession["trafficLight"], string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-black/[.05] px-2 py-0.5 text-xs text-zinc-600 dark:bg-white/[.08] dark:text-zinc-300">{children}</span>;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function painText(knee: number | null, back: number | null): string {
  return `joelho ${knee ?? "—"} · lombar ${back ?? "—"}`;
}

function MorningPain({ session }: { session: WorkoutSession }) {
  const [knee, setKnee] = useState(session.kneePainMorning);
  const [back, setBack] = useState(session.backPainMorning);
  const [, startTransition] = useTransition();

  function save(nextKnee: number | null, nextBack: number | null) {
    setKnee(nextKnee);
    setBack(nextBack);
    startTransition(async () => {
      const result = await updateMorningPain({ sessionId: session.id, kneePainMorning: nextKnee, backPainMorning: nextBack });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg bg-black/[.03] p-2 dark:bg-white/[.04]">
      <p className="w-full text-xs text-zinc-500 dark:text-zinc-400">Dor na manhã seguinte (entra na regra de subir carga)</p>
      <Field label="Joelho">
        <PainSelect allowEmpty label="Dor no joelho na manhã seguinte" value={knee} onChange={(v) => save(v, back)} />
      </Field>
      <Field label="Lombar">
        <PainSelect allowEmpty label="Dor lombar na manhã seguinte" value={back} onChange={(v) => save(knee, v)} />
      </Field>
    </div>
  );
}

export function HistoryTab({
  programs,
  sessions,
  weekly,
  onChanged,
}: {
  programs: WorkoutProgram[];
  sessions: WorkoutSession[];
  weekly: WeeklyMeasure[];
  onChanged: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const today = todayInTimezone();
  const groups = groupByWeek(sessions);

  // Nome do treino ("Inferiores 1…") pelo programa usado no dia; programa apagado → só a letra.
  const workoutName = (s: WorkoutSession) => {
    const program = programs.find((p) => p.id === s.programId);
    return program?.definition.workouts.find((w) => w.id === s.workout)?.name ?? "";
  };

  function handleDelete(id: string) {
    if (!window.confirm("Excluir este treino?")) return;
    startTransition(async () => {
      const result = await deleteWorkoutSession(id);
      if (!result.ok) toast.error(result.error);
      else onChanged();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.length === 0 && <p className={`${cardClassName} text-sm text-zinc-500`}>Nenhum treino registrado ainda.</p>}

      {groups.map((group) => (
        <section key={group.weekStart} className="flex flex-col gap-2">
          <h2 className="flex items-baseline justify-between px-1 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            {weekLabel(group.weekStart, today)}
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
              {group.sessions.length} {group.sessions.length === 1 ? "treino" : "treinos"}
            </span>
          </h2>

          {group.sessions.map((s) => {
            const open = openId === s.id;
            const summary = summarizeSession(s.exercises);
            const cardioOnly = !sessionHasExercises(s);
            const name = workoutName(s);
            const entries = Object.entries(s.exercises);
            return (
              <article key={s.id} className="overflow-hidden rounded-2xl border border-black/[.08] dark:border-white/[.08]">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : s.id)}
                  className="flex w-full items-start gap-3 p-4 text-left hover:bg-black/[.02] dark:hover:bg-white/[.03]"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${LIGHT_BADGE[s.trafficLight]}`}
                    title={`Semáforo: ${TRAFFIC_LIGHT_TEXT[s.trafficLight].title}`}
                  >
                    {cardioOnly ? "🚴" : s.workout}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{formatSessionDay(s.date)}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">sem. {s.week}</span>
                    </span>
                    <span className="truncate text-sm text-zinc-600 dark:text-zinc-300">
                      {cardioOnly ? "Cardio / descanso ativo" : name ? `Treino ${s.workout} · ${name}` : `Treino ${s.workout}`}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                        <span className={`h-2 w-2 rounded-full ${LIGHT_DOT[s.trafficLight]}`} aria-hidden />
                        {TRAFFIC_LIGHT_TEXT[s.trafficLight].title}
                      </span>
                      {s.durationMin ? <Chip>{s.durationMin} min</Chip> : null}
                      <Chip>energia {s.energy}/5</Chip>
                      {!cardioOnly && (
                        <Chip>
                          {plural(summary.exercisesDone, "exercício", "exercícios")} · {plural(summary.sets, "série", "séries")}
                          {summary.volumeKg > 0 ? ` · ${summary.volumeKg.toLocaleString("pt-BR")} kg` : ""}
                        </Chip>
                      )}
                    </span>
                    {s.notes && !open && <span className="truncate text-xs italic text-zinc-500 dark:text-zinc-400">“{s.notes}”</span>}
                  </span>
                  <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                </button>

                {open && (
                  <div className="flex flex-col gap-3 border-t border-black/[.06] px-4 pb-4 pt-3 dark:border-white/[.06]">
                    {entries.length > 0 && (
                      <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.06]">
                        {entries.map(([id, e]) => {
                          const reps = validReps(e.reps);
                          const skipped = e.skipped || reps.length === 0;
                          return (
                            <li key={id} className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 ${skipped ? "opacity-50" : ""}`}>
                              <span className="text-sm font-medium">{e.name ?? id}</span>
                              {skipped ? (
                                <span className="text-xs text-zinc-500">Pulei</span>
                              ) : (
                                <span className="text-sm tabular-nums text-zinc-700 dark:text-zinc-200">
                                  {e.load ? <strong className="font-semibold">{e.load} kg</strong> : null}
                                  {e.load ? " · " : ""}
                                  {reps.join(" · ")}
                                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {e.rir !== null ? ` · RIR ${e.rir}` : ""}
                                    {e.pain > 0 ? ` · dor ${e.pain}` : ""}
                                  </span>
                                </span>
                              )}
                              {e.note && <span className="w-full text-xs italic text-zinc-500 dark:text-zinc-400">{e.note}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {s.notes && (
                      <blockquote className="border-l-2 border-black/[.15] pl-3 text-sm text-zinc-600 dark:border-white/[.2] dark:text-zinc-300">{s.notes}</blockquote>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      <Chip>sono {s.sleepHours ?? "—"} h</Chip>
                      <Chip>dor antes: {painText(s.kneePainBefore, s.backPainBefore)}</Chip>
                      {s.kneePainAfter !== null && <Chip>dor depois: {painText(s.kneePainAfter, s.backPainAfter)}</Chip>}
                    </div>

                    <MorningPain session={s} />
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDelete(s.id)}
                      className="self-end text-xs text-zinc-400 hover:text-red-600 hover:underline dark:hover:text-red-400"
                    >
                      Excluir este treino
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ))}

      <section className={cardClassName}>
        <h2 className="text-sm font-semibold">Exportar (abre no Excel ou Google Sheets)</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadCsv("treinos.csv", buildSessionsCsv(sessions))}
            className="flex-1 rounded-lg border border-black/[.12] py-2 text-sm dark:border-white/[.16]"
          >
            CSV dos treinos
          </button>
          <button
            type="button"
            onClick={() => downloadCsv("semanal.csv", buildWeeklyCsv(weekly, sessions))}
            className="flex-1 rounded-lg border border-black/[.12] py-2 text-sm dark:border-white/[.16]"
          >
            CSV semanal
          </button>
        </div>
      </section>
    </div>
  );
}
