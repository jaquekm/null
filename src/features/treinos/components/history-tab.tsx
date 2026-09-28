"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteWorkoutSession, updateMorningPain } from "../actions";
import { TRAFFIC_LIGHT_TEXT, validReps } from "../lib/rules";
import type { WeeklyMeasure, WorkoutSession } from "../queries";
import { buildSessionsCsv, buildWeeklyCsv, downloadCsv } from "../lib/csv-export";
import { Field, PainSelect, cardClassName, formatShortDate } from "./ui";

const DOT: Record<WorkoutSession["trafficLight"], string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};

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

export function HistoryTab({ sessions, weekly, onChanged }: { sessions: WorkoutSession[]; weekly: WeeklyMeasure[]; onChanged: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const newestFirst = [...sessions].reverse();

  function handleDelete(id: string) {
    if (!window.confirm("Excluir este treino?")) return;
    startTransition(async () => {
      const result = await deleteWorkoutSession(id);
      if (!result.ok) toast.error(result.error);
      else onChanged();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {newestFirst.length === 0 && <p className={`${cardClassName} text-sm text-zinc-500`}>Nenhum treino registrado ainda.</p>}

      {newestFirst.map((s) => {
        const open = openId === s.id;
        return (
          <div key={s.id} className="rounded-xl border border-black/[.08] dark:border-white/[.08]">
            <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : s.id)} className="flex w-full items-center gap-3 p-3 text-left">
              <span className={`h-3 w-3 shrink-0 rounded-full ${DOT[s.trafficLight]}`} aria-label={TRAFFIC_LIGHT_TEXT[s.trafficLight].title} />
              <span className="w-5 font-bold">{s.workout}</span>
              <span className="flex-1 text-sm">
                {formatShortDate(s.date)} · sem. {s.week}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                energia {s.energy}
                {s.durationMin ? ` · ${s.durationMin} min` : ""}
              </span>
            </button>
            {open && (
              <div className="flex flex-col gap-2 px-3 pb-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-zinc-500 dark:text-zinc-400">
                        <th className="py-1 pr-2 font-medium">Exercício</th>
                        <th className="pr-2 font-medium">Carga</th>
                        <th className="pr-2 font-medium">Reps</th>
                        <th className="pr-2 font-medium">RIR</th>
                        <th className="font-medium">Dor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(s.exercises)
                        .filter(([, e]) => !e.skipped && validReps(e.reps).length > 0)
                        .map(([id, e]) => (
                          <tr key={id} className="border-t border-black/[.06] dark:border-white/[.06]">
                            <td className="py-1 pr-2">{e.name ?? id}</td>
                            <td className="pr-2">{e.load}</td>
                            <td className="pr-2">{validReps(e.reps).join("/")}</td>
                            <td className="pr-2">{e.rir ?? ""}</td>
                            <td>{e.pain}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {TRAFFIC_LIGHT_TEXT[s.trafficLight].title} · sono {s.sleepHours ?? "—"} h · dor antes J{s.kneePainBefore}/L{s.backPainBefore}
                  {s.kneePainAfter !== null ? ` · depois J${s.kneePainAfter}/L${s.backPainAfter ?? 0}` : ""}
                  {s.notes ? ` · ${s.notes}` : ""}
                </p>
                <MorningPain session={s} />
                <button type="button" disabled={pending} onClick={() => handleDelete(s.id)} className="self-start text-xs text-red-600 hover:underline dark:text-red-400">
                  Excluir este treino
                </button>
              </div>
            )}
          </div>
        );
      })}

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
